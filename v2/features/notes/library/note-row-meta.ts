import type { NoteRowModel } from '../note-row-model';
import type { NotesTab } from './NoteTabs';

/**
 * The grey meta line under a note row's summary (the owner's take A, 23
 * October 2026), as the text parts the row joins with a "·".
 *
 *   My notes    date            "23 Oct", or "23 Oct · From a chat"
 *   All notes   author · date   "Ada Okafor · 23 Oct"
 *
 * On My notes the author is always the reader, so their name is left out. On
 * All notes the author comes first. The tags follow as pills on a computer
 * only ({@link rowTags}). A part the note does not have (no author name, an
 * unparseable date) is dropped, never replaced with filler.
 *
 * `now` is the list's frozen clock (no `Date.now()` in render): it only
 * decides whether the year is printed.
 */
export function noteRowMeta(
  row: Pick<NoteRowModel, 'author' | 'updatedAt'> & Partial<Pick<NoteRowModel, 'fromChat'>>,
  tab: NotesTab,
  now: number,
): string[] {
  const date = formatRowDate(row.updatedAt, now);
  // A draft Lawexa wrote, now the reader's note (drafts saved as notes).
  const parts = tab === 'mine' ? [date, row.fromChat ? 'From a chat' : ''] : [row.author ?? '', date];
  return parts.filter((part) => part.length > 0);
}

/** Tags a row shows before "+N". */
export const ROW_TAGS = 3;

/**
 * The tags a row shows, the same on both tabs: the first {@link ROW_TAGS},
 * then a count of the rest, so a note with nine tags still fits its one line.
 * `null` for a note with no tags.
 *
 * Rows show them on a computer only (from the `sm` breakpoint, 640px). A phone
 * row has no tags; the note's own page shows all of them on both (Stay, 25
 * October 2026).
 */
export function rowTags(tags: readonly string[]): { shown: string[]; more: number } | null {
  if (tags.length === 0) return null;
  return { shown: tags.slice(0, ROW_TAGS), more: Math.max(0, tags.length - ROW_TAGS) };
}

const SAME_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const OTHER_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "23 Oct" this year, "23 Oct 2025" for any other; `''` when unparseable. */
export function formatRowDate(iso: string, now: number): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  const format = date.getFullYear() === new Date(now).getFullYear() ? SAME_YEAR : OTHER_YEAR;
  return format.format(date);
}
