import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { NoteEnvelope, NoteListEnvelope } from '../types';
import { notesQueries } from '../queries';

/**
 * note bookmark cache — the shape-aware writer that flips a note's bookmark
 * state everywhere it is already on screen. The design of
 * `v2/features/statutes/bookmark/cache.ts` (itself the case writer's), applied
 * to the three notes shapes that carry the flag:
 *
 *   - `InfiniteData<NoteListEnvelope>`  — the library stream AND My notes
 *   - `NoteEnvelope`                     — the reader's note (`detail` by slug)
 *   - `NoteEnvelope`                     — the editor's note (`byId`)
 *
 * The last two are separate cache entries under `details()` on purpose (see
 * `queries.ts`), and the fan-out walking the whole family is exactly why a
 * star pressed in the reader is already pressed if the editor is opened next.
 *
 * Same contracts as the originals: referential stability on a no-op (an
 * untouched entry returns its exact input, so TanStack's tracked-props
 * optimisation suppresses the re-render even though the write still
 * dispatches — consumers must therefore not read `dataUpdatedAt`), counts are
 * MOVED by ±1 and clamped at zero rather than invented, and the fan-out and
 * the rollback snapshot cover exactly the same set of entries.
 */

type NoteCache = InfiniteData<NoteListEnvelope> | NoteEnvelope;

/** A record carrying the two bookmark fields, whatever else it holds. */
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
function applyToRows<T extends Bookmarkable>(rows: T[], id: number, next: boolean): T[] {
  let changed = false;
  const mapped = rows.map((row) => {
    const updated = applyToRow(row, id, next);
    if (updated !== row) changed = true;
    return updated;
  });
  return changed ? mapped : rows;
}

/** Flip the bookmark state of one note in whatever shape this entry holds. */
export function applyNoteBookmarkToCache(
  cache: NoteCache | undefined,
  id: number,
  next: boolean,
): NoteCache | undefined {
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
 * Write the flag across every cached notes surface. Returns the snapshot taken
 * BEFORE the write, so the mutation can restore it verbatim on failure — the
 * fan-out and the rollback then cover exactly the same entries, which is the
 * only way a multi-surface optimistic write can be safely undone.
 */
export function writeNoteBookmarkEverywhere(
  queryClient: QueryClient,
  id: number,
  next: boolean,
): [readonly unknown[], NoteCache | undefined][] {
  const filters = [
    { queryKey: notesQueries.lists() },
    { queryKey: notesQueries.details() },
  ];
  const snapshot = filters.flatMap((filter) =>
    queryClient.getQueriesData<NoteCache>(filter),
  );
  for (const filter of filters) {
    queryClient.setQueriesData<NoteCache>(filter, (cache) =>
      applyNoteBookmarkToCache(cache, id, next),
    );
  }
  return snapshot;
}

/** Restore a snapshot produced by {@link writeNoteBookmarkEverywhere}. */
export function restoreNoteBookmarkSnapshot(
  queryClient: QueryClient,
  snapshot: [readonly unknown[], NoteCache | undefined][],
): void {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data);
  }
}
