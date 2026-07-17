import {
  mutationOptions,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { V2MutationMeta } from './query';

/**
 * Feedback-policy mutation helpers (standards §2). They make the correct pattern
 * the easy path: pre-wired `onMutate` / `onError` / `onSettled` (or `onSuccess`)
 * so feature code writes a `mutationFn` + a cache-updater and nothing else.
 *
 * Both take the `QueryClient` explicitly (grab it once per component with
 * `useQueryClient()`), because a mutation's lifecycle callbacks don't receive
 * the client. Both RETURN a `mutationOptions` object — spread it into
 * `useMutation()` and always call `mutate` (fire-and-forget), never
 * `mutateAsync` (standards §2).
 *
 * The error TOAST is intentionally absent from both: the global
 * `MutationCache.onError` (see `query.ts`) is the single error channel. These
 * helpers only handle cache mechanics (rollback / patch / invalidation).
 */

/** Context carried from `onMutate` to `onError` for rollback. */
interface OptimisticContext<TQueryData> {
  previous: TQueryData | undefined;
}

export interface OptimisticMutationConfig<TData, TVariables, TQueryData> {
  /** The write. Its resolved value is ignored — the optimistic update is the UI. */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** The single cache entry this mutation optimistically edits. */
  queryKey: QueryKey;
  /** Produce the optimistic next value from the current one (pure). */
  optimisticUpdate: (
    previous: TQueryData | undefined,
    variables: TVariables,
  ) => TQueryData | undefined;
  /**
   * Identity for the settle-once guard. Defaults to `['optimistic', ...queryKey]`.
   * Give related mutations (e.g. check + uncheck of the same list) the same key
   * so a rapid burst reconciles once at the end.
   */
  mutationKey?: QueryKey;
  /** Extra keys to invalidate on success, run by the global `onSuccess`. */
  meta?: V2MutationMeta;
  /** Serialize concurrent edits to the same entity (standards §2). */
  scope?: { id: string };
}

/**
 * Optimistic mutation for toggles / sends / checks: snapshot + immediate cache
 * write on `onMutate`, rollback on `onError`, reconcile on `onSettled`.
 *
 * - `onMutate` `await`s `cancelQueries` first so no in-flight refetch clobbers
 *   the optimistic value, snapshots the previous data, then writes the update.
 * - `onError` restores the snapshot. (The toast is the global handler's job.)
 * - `onSettled` invalidates ONLY when this is the last mutation OF THIS KIND in
 *   flight — `isMutating({ mutationKey }) === 1`, SCOPED to the helper's
 *   `mutationKey` (default `['optimistic', ...queryKey]`). An unscoped
 *   `isMutating()` counts every pending mutation on the shared v2 client, so an
 *   unrelated background mutation (a chat send) would permanently suppress this
 *   toggle's reconcile — the scoped count can't be starved that way.
 */
export function optimisticMutation<TData, TVariables, TQueryData>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TData, TVariables, TQueryData>,
) {
  const { mutationFn, queryKey, optimisticUpdate, meta, scope } = config;
  const mutationKey = config.mutationKey ?? ['optimistic', ...queryKey];

  return mutationOptions<TData, Error, TVariables, OptimisticContext<TQueryData>>({
    mutationFn,
    mutationKey,
    ...(meta ? { meta } : {}),
    ...(scope ? { scope } : {}),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TQueryData>(queryKey);
      queryClient.setQueryData<TQueryData>(queryKey, (old) =>
        optimisticUpdate(old, variables),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      // Roll back to the snapshot. `context` is undefined only if `onMutate`
      // threw before returning, in which case there's nothing to restore.
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export interface PatchingMutationConfig<TData, TVariables, TQueryData> {
  /** The write. Its resolved value is the server's authoritative new state. */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** The cache entry to patch with the server response. */
  queryKey: QueryKey;
  /** Fold the server response into the cached value (pure). */
  applyResult: (
    previous: TQueryData | undefined,
    data: TData,
    variables: TVariables,
  ) => TQueryData | undefined;
  /** Extra keys to invalidate on success, run by the global `onSuccess`. */
  meta?: V2MutationMeta;
  /** Serialize concurrent edits to the same entity (standards §2). */
  scope?: { id: string };
}

/**
 * Non-optimistic mutation that writes the SERVER response straight into the
 * cache on success (no interim guess, no rollback needed) — for
 * create/update/save flows where you want the server's canonical row rendered
 * the moment it returns, without a follow-up refetch of that entry.
 *
 * Cross-surface invalidation (lists, counters, other features) is declared via
 * `meta.invalidates` and executed by the global `MutationCache.onSuccess`; keep
 * the patched `queryKey` OUT of `meta.invalidates` or you'd refetch what you
 * just wrote.
 */
export function patchingMutation<TData, TVariables, TQueryData>(
  queryClient: QueryClient,
  config: PatchingMutationConfig<TData, TVariables, TQueryData>,
) {
  const { mutationFn, queryKey, applyResult, meta, scope } = config;

  return mutationOptions<TData, Error, TVariables>({
    mutationFn,
    ...(meta ? { meta } : {}),
    ...(scope ? { scope } : {}),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<TQueryData>(queryKey, (previous) =>
        applyResult(previous, data, variables),
      );
    },
  });
}
