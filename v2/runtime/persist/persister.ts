import {
  experimental_createQueryPersister,
  type PersistedQuery,
} from '@tanstack/query-persist-client-core';
import {
  notifyManager,
  type Query,
  type QueryFunction,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import {
  isGoneError,
  isStorableAnswer,
  PERSIST_MAX_AGE_MS,
  PERSIST_SCHEMA_VERSION,
  persistModeOf,
} from './policy';
import type { QueryStorage } from './query-storage';

/** The storage key prefix TanStack puts before each query hash. */
export const PERSIST_PREFIX = 'lq';

export interface V2Persister {
  /** Passed to the client as `defaultOptions.queries.persister`. */
  persisterFn: <T>(
    queryFn: QueryFunction<T, QueryKey, never>,
    context: QueryFunctionContext<QueryKey>,
    query: Query,
  ) => Promise<T>;
  /** Removes kept answers past their age or from another schema version. */
  gc: () => Promise<void>;
}

/**
 * TanStack's per-query persister, with the device cache's rules around it.
 *
 * The library's own `persisterFn` restores, refetches when stale, and keeps
 * every successful answer. Ours uses the library's `retrieveQuery` and
 * `persistQuery` and adds the rules the plan's amendments require:
 *
 * - Only leaves with `meta.persist` are touched; every other query runs as if
 *   no persister existed.
 * - RESTORE only when the query holds no data, so a server-rendered (hydrated)
 *   answer always wins over the device copy. A `'gated'` leaf refetches on
 *   EVERY restore; a `'list'` leaf refetches when the restored copy is stale.
 * - KEEP only a full answer (`isStorableAnswer`). A limited answer (plan limit,
 *   no access) or a chat still being answered is shown but not kept, and it
 *   DELETES the kept copy, so a lapsed plan never sees the old full text again.
 * - A refused read (401, 403, 404, 410, confidential) deletes the kept copy and
 *   still fails as before. A timeout, 429 or 5xx keeps it.
 */
export function makeV2Persister(storage: QueryStorage): V2Persister {
  const core = experimental_createQueryPersister<unknown>({
    storage,
    buster: String(PERSIST_SCHEMA_VERSION),
    maxAge: PERSIST_MAX_AGE_MS,
    prefix: PERSIST_PREFIX,
    // IndexedDB keeps structured clones; no JSON step.
    serialize: (persisted) => persisted,
    deserialize: (stored) => stored as PersistedQuery,
  });
  const keyOf = (query: Query) => `${PERSIST_PREFIX}-${query.queryHash}`;

  async function persisterFn<T>(
    queryFn: QueryFunction<T, QueryKey, never>,
    context: QueryFunctionContext<QueryKey>,
    query: Query,
  ): Promise<T> {
    const mode = persistModeOf(query.meta);
    if (!mode) return queryFn(context);

    if (query.state.data === undefined) {
      const restored = await core.retrieveQuery<T>(query.queryHash, (persisted) => {
        query.setState({
          dataUpdatedAt: persisted.state.dataUpdatedAt,
          errorUpdatedAt: persisted.state.errorUpdatedAt,
        });
        // The refetch's failure lands in the query's own error state; the
        // promise is caught so it never surfaces as an unhandled rejection.
        if (mode === 'gated' || query.isStale()) query.fetch().catch(() => undefined);
      });
      if (restored !== undefined) return restored;
    }

    let answer: T;
    try {
      answer = await queryFn(context);
    } catch (error) {
      if (isGoneError(error)) await storage.removeItem(keyOf(query));
      throw error;
    }

    if (isStorableAnswer(answer)) {
      // After this answer is in the query's state, as the library does.
      notifyManager.schedule(() => {
        void core.persistQuery(query);
      });
    } else {
      await storage.removeItem(keyOf(query));
    }
    return answer;
  }

  return { persisterFn, gc: core.persisterGc };
}
