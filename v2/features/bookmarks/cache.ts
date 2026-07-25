import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { CaseDetailResponse, CaseListResponse } from '@/types/case';
import type { TrendingCasesResponse } from '@/types/trending';
import { casesQueries } from '@/v2/features/cases/queries';

/**
 * bookmarks cache — the ONE shape-aware writer that flips a case's bookmark
 * state everywhere it is already on screen.
 *
 * WHY IT IS NOT `optimisticMutation`. That helper (v2/runtime/mutations.ts) edits
 * ONE cache entry. A bookmark is the opposite: the same case can be visible in
 * the browse list, the trending list, the case page, a hover preview and the
 * Study home's saved strip at the same moment, each under a different key. A
 * per-key mutation would flip the star the user pressed and leave every other
 * copy of that case stale until its own refetch — the "same thing shows two
 * different states" bug class. So this fans out across the whole `cases`
 * namespace in one pass, and the mutation snapshots the same set for rollback.
 *
 * FOUR SHAPES live under those keys and all of them carry the flag:
 *   - `CaseListResponse`                        — the flat list peek
 *   - `InfiniteData<CaseListResponse>`          — the browse list
 *   - `InfiniteData<TrendingCasesResponse>`     — the trending view
 *   - `CaseDetailResponse`                      — preview / case page / report
 *
 * REFERENTIAL STABILITY ON A NO-OP is deliberate and load-bearing: the fan-out
 * touches every cached list, and most of them do not contain the toggled case.
 * When a transform changes nothing it returns its exact input, so TanStack's
 * tracked-props optimisation suppresses the re-render even though the write
 * still dispatches. Consumers must therefore not read `dataUpdatedAt` or set
 * `notifyOnChangeProps: 'all'` — the same contract `conversations/cache.ts`
 * documents.
 *
 * COUNTS ARE MOVED, NOT INVENTED. `bookmarks_count` is nudged by exactly ±1 and
 * clamped at zero; nothing here fabricates a total. The server response is the
 * authority and the mutation's settle-time invalidation reconciles it.
 */

/** Every cached shape that can hold a case's bookmark flag. */
type CaseCache =
  | CaseListResponse
  | InfiniteData<CaseListResponse>
  | TrendingCasesResponse
  | InfiniteData<TrendingCasesResponse>
  | CaseDetailResponse;

/** A row (or record) carrying the two bookmark fields, whatever else it holds. */
type Bookmarkable = { id: number; is_bookmarked: boolean; bookmarks_count?: number };

/** Flip one record. Returns the SAME reference when this is not the target. */
function applyToRow<T extends Bookmarkable>(row: T, id: number, next: boolean): T {
  if (row.id !== id || row.is_bookmarked === next) return row;
  const delta = next ? 1 : -1;
  return {
    ...row,
    is_bookmarked: next,
    ...(typeof row.bookmarks_count === 'number'
      ? { bookmarks_count: Math.max(0, row.bookmarks_count + delta) }
      : {}),
  };
}

/** Flip within one array, preserving identity when nothing matched. */
function applyToRows<T extends Bookmarkable>(
  rows: T[],
  id: number,
  next: boolean,
): T[] {
  let changed = false;
  const mapped = rows.map((row) => {
    const updated = applyToRow(row, id, next);
    if (updated !== row) changed = true;
    return updated;
  });
  return changed ? mapped : rows;
}

/**
 * Flip the bookmark state of one case in whatever shape this cache entry holds.
 * Exported for the mutation; not called directly by components.
 */
export function applyBookmarkToCache(
  cache: CaseCache | undefined,
  id: number,
  next: boolean,
): CaseCache | undefined {
  if (!cache) return cache;

  // The four shapes are read through ONE structural view: "an envelope holding
  // either an array of bookmarkables or a single one". The list envelopes differ
  // in fields TypeScript cares about (`TrendingCasesResponse` carries `meta`,
  // `CaseListResponse` does not) and in nothing this function touches, so a
  // union of the full response types would only make the mapping unprovable —
  // it maps `data` and copies the rest by spread, which is field-agnostic.
  const view = cache as unknown as
    | { pages: { data: Bookmarkable[] }[] }
    | { data: Bookmarkable[] }
    | { data: Bookmarkable | null };

  if ('pages' in view) {
    let changed = false;
    const pages = view.pages.map((page) => {
      const rows = applyToRows(page.data, id, next);
      if (rows === page.data) return page;
      changed = true;
      return { ...page, data: rows };
    });
    return changed ? ({ ...view, pages } as unknown as CaseCache) : cache;
  }

  if (Array.isArray(view.data)) {
    const rows = applyToRows(view.data, id, next);
    return rows === view.data
      ? cache
      : ({ ...view, data: rows } as unknown as CaseCache);
  }

  const detail = view.data;
  if (!detail) return cache;
  const updated = applyToRow(detail, id, next);
  return updated === detail
    ? cache
    : ({ ...view, data: updated } as unknown as CaseCache);
}

/**
 * Write the flag across every cached case surface. Returns the snapshot taken
 * BEFORE the write, so the mutation can restore it verbatim on failure — the
 * fan-out and the rollback then cover exactly the same set of entries, which is
 * the only way a multi-surface optimistic write can be safely undone.
 */
export function writeBookmarkEverywhere(
  queryClient: QueryClient,
  id: number,
  next: boolean,
): [readonly unknown[], CaseCache | undefined][] {
  // `lists()` and `details()`, never the `all` root: the cases namespace ALSO
  // holds `casesQueries.conversations`, whose rows are conversations, not cases.
  // Walking them would be harmless at runtime (a string id never equals a number
  // one, so every row returns unchanged) and dishonest in the types — so the
  // fan-out names exactly the two families that carry the flag.
  const filters = [
    { queryKey: casesQueries.lists() },
    { queryKey: casesQueries.details() },
  ];
  const snapshot = filters.flatMap((filter) =>
    queryClient.getQueriesData<CaseCache>(filter),
  );
  for (const filter of filters) {
    queryClient.setQueriesData<CaseCache>(filter, (cache) =>
      applyBookmarkToCache(cache, id, next),
    );
  }
  return snapshot;
}

/** Restore a snapshot produced by {@link writeBookmarkEverywhere}. */
export function restoreBookmarkSnapshot(
  queryClient: QueryClient,
  snapshot: [readonly unknown[], CaseCache | undefined][],
): void {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data);
  }
}
