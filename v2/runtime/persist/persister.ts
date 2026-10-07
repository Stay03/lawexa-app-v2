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
import { REFETCH_ON_VISIT } from '../query';

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
 * every successful answer. Ours uses the library's `retrieveQuery`, writes the
 * kept answer in the library's own format, and adds the rules the plan's
 * amendments require:
 *
 * - Only leaves with `meta.persist` are touched; every other query runs as if
 *   no persister existed.
 * - RESTORE only when the query holds no data, so a server-rendered (hydrated)
 *   answer always wins over the device copy. A `'gated'` leaf refetches on
 *   EVERY restore; a `'list'` leaf refetches when the restored copy is stale,
 *   or always when the leaf re-checks on every visit (REFETCH_ON_VISIT).
 * - KEEP the answer the read received, never the cache as later edited.
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

  /**
   * A leaf that asks the server on every visit (`refetchOnMount: 'always'`,
   * REFETCH_ON_VISIT). A restore answers the mount's fetch from the device, so
   * without this the visit's check never went out while the copy was fresh,
   * and a list kept with a row missing stayed that way for up to its stale time.
   */
  const checksOnEveryVisit = (query: Query) =>
    'refetchOnMount' in query.options && query.options.refetchOnMount === REFETCH_ON_VISIT;

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
        if (mode === 'gated' || query.isStale() || checksOnEveryVisit(query)) {
          query.fetch().catch(() => undefined);
        }
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
    const answeredAt = Date.now();

    if (isStorableAnswer(answer)) {
      // Written after this answer is in the query's state, as the library
      // does, but it writes THIS read's answer, not whatever the cache holds by
      // the time the write runs. A cache edit landing in between (a row removed
      // by conversationsCache.remove, an optimistic bump) is the app's view,
      // not the server's, and once kept it painted as the server's list on the
      // next load (a conversation the server still listed was missing,
      // 7 October 2026). A later read writes its own answer after this one.
      notifyManager.schedule(() => {
        const kept: PersistedQuery = {
          buster: String(PERSIST_SCHEMA_VERSION),
          queryHash: query.queryHash,
          queryKey: query.queryKey,
          state: { ...query.state, data: answer, dataUpdatedAt: answeredAt },
        };
        void storage.setItem(keyOf(query), kept);
      });
    } else {
      await storage.removeItem(keyOf(query));
    }
    return answer;
  }

  return { persisterFn, gc: core.persisterGc };
}
