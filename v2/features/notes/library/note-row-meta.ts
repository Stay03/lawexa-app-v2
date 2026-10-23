import type { NoteRowModel } from '../note-row-model';
import type { NotesTab } from './NoteTabs';

/**
 * The grey meta line under a note row's summary (the owner's take A, 23
 * October 2026), as the parts the row joins with a "·".
 *
 *   My notes    date · tags          "23 Oct · Land law, Property"
 *   All notes   author · date · tag  "Ada Okafor · 23 Oct · Land law"
 *
 * On My notes the author is always the reader, so their name is left out and
 * every tag shows. On All notes the author comes first, and only the FIRST tag
 * shows, so the line stays one line with a name in it. A part the note does
 * not have (no author name, no tags, an unparseable date) is dropped, never
 * replaced with filler.
 *
 * `now` is the list's frozen clock (no `Date.now()` in render): it only
 * decides whether the year is printed.
 */
export function noteRowMeta(
  row: Pick<NoteRowModel, 'author' | 'updatedAt' | 'tags'>,
  tab: NotesTab,
  now: number,
): string[] {
  const date = formatRowDate(row.updatedAt, now);
  const parts =
    tab === 'mine'
      ? [date, row.tags.join(', ')]
      : [row.author ?? '', date, row.tags[0] ?? ''];
  return parts.filter((part) => part.length > 0);
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
