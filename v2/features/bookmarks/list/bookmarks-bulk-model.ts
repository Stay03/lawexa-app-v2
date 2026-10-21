import type { BookmarkType } from '@/types/bookmark';
import type { BookmarkRowModel } from '../bookmark-row-model';

/**
 * Saved's bulk keys (Arthur, 20 October 2026, part 3). A ticked row is its
 * kind and its CONTENT's numeric id: the pair `POST /bulk/bookmarks` takes and
 * echoes back per item (a folder's id, not its uuid), and the pair the one-item
 * toggle takes. Pure, so the tests read it without the screen.
 */
export type SavedKey = `${BookmarkType}:${number}`;

export const savedKey = (row: Pick<BookmarkRowModel, 'type' | 'contentId'>): SavedKey => `${row.type}:${row.contentId}`;

/** The item the server takes for a key. */
export function savedItem(key: SavedKey): { type: BookmarkType; id: number } {
  const at = key.indexOf(':');
  return { type: key.slice(0, at) as BookmarkType, id: Number(key.slice(at + 1)) };
}
