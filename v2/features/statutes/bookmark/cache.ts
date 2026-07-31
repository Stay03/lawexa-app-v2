import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { StatuteDetailResponse, StatuteListResponse } from '@/types/statute';
import { statutesQueries } from '../queries';

/**
 * statute bookmark cache — the shape-aware writer that flips a statute's
 * bookmark state everywhere it is already on screen. The exact design of
 * `v2/features/bookmarks/cache.ts` (which is CASE-scoped and typed to case
 * envelopes — see the open note there about generalising), applied to the two
 * statute shapes that carry the flag:
 *
 *   - `InfiniteData<StatuteListResponse>`  — the browse list
 *   - `StatuteDetailResponse`              — the reader's metadata entry
 *
 * Same contracts as the original: referential stability on a no-op (an
 * untouched entry returns its exact input so tracked-props suppresses the
 * re-render), counts are MOVED by ±1 and clamped, never invented, and the
 * fan-out and the rollback snapshot cover exactly the same set of entries.
 *
 * The AKN entry (`statutesQueries.akn`) is a raw XML string with no bookmark
 * flag, and it lives outside `lists()`/`details()` — the fan-out never touches
 * it, so a star press can never dirty a quarter-megabyte document.
 */

type StatuteCache =
  | InfiniteData<StatuteListResponse>
  | StatuteDetailResponse;

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

/** Flip the bookmark state of one statute in whatever shape this entry holds. */
export function applyBookmarkToCache(
  cache: StatuteCache | undefined,
  id: number,
  next: boolean,
): StatuteCache | undefined {
  if (!cache) return cache;

  if ('pages' in cache) {
    let changed = false;
    const pages = cache.pages.map((page) => {
      const rows = applyToRows(page.data, id, next);
      if (rows === page.data) return page;
      changed = true;
      return { ...page, data: rows };
    });
    return changed ? { ...cache, pages } : cache;
  }

  const detail = cache.data;
  if (!detail) return cache;
  const updated = applyToRow(detail, id, next);
  return updated === detail ? cache : { ...cache, data: updated };
}

/**
 * Write the flag across every cached statute surface. Returns the snapshot
 * taken BEFORE the write, so the mutation can restore it verbatim on failure.
 */
export function writeStatuteBookmarkEverywhere(
  queryClient: QueryClient,
  id: number,
  next: boolean,
): [readonly unknown[], StatuteCache | undefined][] {
  const filters = [
    { queryKey: statutesQueries.lists() },
    { queryKey: statutesQueries.details() },
  ];
  const snapshot = filters.flatMap((filter) =>
    queryClient.getQueriesData<StatuteCache>(filter),
  );
  for (const filter of filters) {
    queryClient.setQueriesData<StatuteCache>(filter, (cache) =>
      applyBookmarkToCache(cache, id, next),
    );
  }
  return snapshot;
}

/** Restore a snapshot produced by {@link writeStatuteBookmarkEverywhere}. */
export function restoreStatuteBookmarkSnapshot(
  queryClient: QueryClient,
  snapshot: [readonly unknown[], StatuteCache | undefined][],
): void {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data);
  }
}
