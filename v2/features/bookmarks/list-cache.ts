import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type {
  Bookmark,
  BookmarkListResponse,
  BookmarkType,
} from '@/types/bookmark';
import { bookmarksQueries } from './queries';

/**
 * bookmarks LIST cache — the writer that takes ONE row out of every cached
 * bookmark list the moment its star is pressed, and the writer that puts THAT
 * ROW (and only that row) back if the request fails.
 *
 * WHY IT IS SEPARATE FROM `cache.ts`. That file flips the `is_bookmarked` FLAG
 * on cached CASE surfaces; this one removes a ROW from cached BOOKMARK lists.
 * Different shapes, different operation, opposite direction — and on the
 * `/bookmarks` page both must happen at once, because un-starring a case there
 * has to empty the row AND turn the star off wherever that case is also on
 * screen.
 *
 * ── ROLLBACK IS A RE-INSERT, NOT A SNAPSHOT RESTORE (review F1) ─────────────
 * The obvious design — snapshot every list entry, restore it on error — is
 * WRONG here, and provably so. Rows are un-saved by independent mutations
 * (different `scope` ids, so they run in PARALLEL). Snapshot-restore replays a
 * whole cache entry as it looked at ONE mutation's `onMutate`, which is a
 * different moment for each of them:
 *
 *     remove A  → snapshot holds [A, B, C]
 *     remove B  → snapshot holds [B, C];  B's DELETE succeeds, B is gone
 *     A fails   → restore [A, B, C]  ← B is RESURRECTED as saved
 *
 * and nothing corrects it: `meta.invalidates` only fires on success. So the
 * rollback here re-inserts the ONE row it removed, into the LIVE cache, at the
 * position it held (clamped into range) — a write that is correct no matter
 * what else happened to that entry in the meantime. Rows removed successfully
 * by a concurrent mutation stay removed.
 *
 * REMOVAL ONLY, NEVER INSERTION-ON-SAVE. Un-saving is fabricable from what the
 * client already holds; re-saving is not — a new bookmark has a server-assigned
 * id and `created_at` that nothing here can invent. So `next: true` writes
 * nothing and lets the mutation's `meta.invalidates` refetch settle it. In
 * practice this page only ever removes: every row on it is, by definition,
 * already bookmarked.
 *
 * TWO SHAPES live under `bookmarksQueries.lists()` and both are handled:
 *   - `InfiniteData<BookmarkListResponse>` — the `/bookmarks` page
 *   - `BookmarkListResponse`               — the flat home "recents" peek
 * Handling both is what makes un-starring from this page also empty the row
 * from the home glance, with no coordination between the two surfaces.
 *
 * REFERENTIAL STABILITY ON A NO-OP is deliberate and load-bearing, exactly as
 * in `cache.ts`: the fan-out visits every cached list and most of them do not
 * hold the row, so an entry that does not contain it is never written at all
 * and TanStack's tracked-props optimisation suppresses the re-render.
 *
 * THE PAGINATION ENVELOPE IS LEFT ALONE. `total`/`last_page` belong to the
 * server's view of the collection; decrementing one and not the other would
 * make `getNextPageParam` disagree with `total`, and nothing on this page
 * renders a count anyway. The settle-time invalidation reconciles the envelope.
 */

/** Every cached shape that can hold a bookmark row. */
type BookmarksCache = BookmarkListResponse | InfiniteData<BookmarkListResponse>;

/** Where one removed row sat, in one cache entry. */
interface RemovedPlacement {
  readonly queryKey: readonly unknown[];
  /** Index into `pages`, or `null` when the entry is the flat envelope. */
  readonly pageIndex: number | null;
  readonly rowIndex: number;
  /** The removed row itself — the only thing the rollback puts back. */
  readonly row: Bookmark;
}

/** The record a removal hands its mutation, so the rollback is row-scoped. */
export interface BookmarkRemoval {
  readonly type: BookmarkType;
  readonly contentId: number;
  readonly placements: readonly RemovedPlacement[];
}

/** Does this row point at the content being un-saved? */
function isTarget(row: Bookmark, type: BookmarkType, contentId: number): boolean {
  return row.type === type && row.content.id === contentId;
}

function holdsTarget(
  rows: readonly Bookmark[],
  type: BookmarkType,
  contentId: number,
): boolean {
  return rows.some((row) => isTarget(row, type, contentId));
}

/**
 * Remove the row from every cached bookmark list and record where each copy
 * sat. Returns the record the mutation keeps for its rollback.
 */
export function removeBookmarkFromLists(
  queryClient: QueryClient,
  type: BookmarkType,
  contentId: number,
): BookmarkRemoval {
  const placements: RemovedPlacement[] = [];

  for (const [queryKey, cache] of queryClient.getQueriesData<BookmarksCache>({
    queryKey: bookmarksQueries.lists(),
  })) {
    if (!cache) continue;

    if ('pages' in cache) {
      let changed = false;
      const pages = cache.pages.map((page, pageIndex) => {
        const rowIndex = page.data.findIndex((row) => isTarget(row, type, contentId));
        if (rowIndex === -1) return page;
        placements.push({
          queryKey,
          pageIndex,
          rowIndex,
          row: page.data[rowIndex],
        });
        changed = true;
        return { ...page, data: page.data.filter((_, index) => index !== rowIndex) };
      });
      if (changed) queryClient.setQueryData(queryKey, { ...cache, pages });
      continue;
    }

    const rowIndex = cache.data.findIndex((row) => isTarget(row, type, contentId));
    if (rowIndex === -1) continue;
    placements.push({
      queryKey,
      pageIndex: null,
      rowIndex,
      row: cache.data[rowIndex],
    });
    queryClient.setQueryData(queryKey, {
      ...cache,
      data: cache.data.filter((_, index) => index !== rowIndex),
    });
  }

  return { type, contentId, placements };
}

/** Put one placement's row back into whatever that entry holds NOW. */
function insertPlacement(
  cache: BookmarksCache | undefined,
  placement: RemovedPlacement,
  type: BookmarkType,
  contentId: number,
): BookmarksCache | undefined {
  // The entry was garbage-collected, or its shape changed under us — either way
  // there is nothing to put the row back into, and the next fetch is authority.
  if (!cache) return cache;

  if ('pages' in cache) {
    if (placement.pageIndex === null || cache.pages.length === 0) return cache;
    // A refetch may already have brought the row back; never duplicate it.
    if (cache.pages.some((page) => holdsTarget(page.data, type, contentId))) {
      return cache;
    }
    const pageIndex = Math.min(placement.pageIndex, cache.pages.length - 1);
    const page = cache.pages[pageIndex];
    const rowIndex = Math.min(placement.rowIndex, page.data.length);
    const data = [
      ...page.data.slice(0, rowIndex),
      placement.row,
      ...page.data.slice(rowIndex),
    ];
    const pages = cache.pages.map((entry, index) =>
      index === pageIndex ? { ...page, data } : entry,
    );
    return { ...cache, pages };
  }

  if (placement.pageIndex !== null || holdsTarget(cache.data, type, contentId)) {
    return cache;
  }
  const rowIndex = Math.min(placement.rowIndex, cache.data.length);
  return {
    ...cache,
    data: [
      ...cache.data.slice(0, rowIndex),
      placement.row,
      ...cache.data.slice(rowIndex),
    ],
  };
}

/**
 * Undo one {@link removeBookmarkFromLists}. Writes into the LIVE cache — never
 * a snapshot — so a concurrent removal that succeeded in the meantime is left
 * exactly as it is. Positions are clamped, so a list that shrank (a page
 * dropped, a refetch landed) still receives the row somewhere sensible rather
 * than losing it.
 */
export function reinsertRemovedBookmark(
  queryClient: QueryClient,
  removal: BookmarkRemoval,
): void {
  for (const placement of removal.placements) {
    queryClient.setQueryData<BookmarksCache>(placement.queryKey, (cache) =>
      insertPlacement(cache, placement, removal.type, removal.contentId),
    );
  }
}
