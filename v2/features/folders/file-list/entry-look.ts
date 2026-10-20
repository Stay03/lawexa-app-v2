import {
  BookText,
  File,
  FileImage,
  FileMusic,
  FilePlay,
  FileSpreadsheet,
  FileText,
  Folder,
  Gavel,
  Presentation,
  type LucideIcon,
} from 'lucide-react';

/**
 * How one entry of a folder list looks: its glyph and the colour of that glyph
 * (Stay picked folder page B, 20 October 2026, 00:49 UTC; "make it look like a
 * clean file system", 00:54 UTC). The colour says the type at a glance, the way
 * a file manager's icons do, so a row needs no words under its name.
 *
 * Each colour has a light and a dark ink, both readable on the page's ground.
 * A file is coloured by its kind (`fileKind` in `item-row-model.ts`); a kind
 * with no colour of its own, or none at all, stays in the muted ink.
 */

export type FileListEntry =
  | { type: 'folder' | 'case' | 'statute' | 'note' }
  | { type: 'file'; kind: string | null };

export interface EntryLook {
  icon: LucideIcon;
  /** Text-colour classes for the glyph. */
  tone: string;
}

const MUTED = 'text-muted-foreground';

const LOOK: Record<Exclude<FileListEntry['type'], 'file'>, EntryLook> = {
  folder: { icon: Folder, tone: 'text-amber-500 dark:text-amber-400' },
  note: { icon: FileText, tone: 'text-sky-600 dark:text-sky-400' },
  case: { icon: Gavel, tone: 'text-violet-600 dark:text-violet-400' },
  statute: { icon: BookText, tone: 'text-emerald-600 dark:text-emerald-400' },
};

/** The file kinds with a look of their own, keyed by `fileKind`'s words. */
const FILE_LOOK: Record<string, EntryLook> = {
  PDF: { icon: File, tone: 'text-red-600 dark:text-red-400' },
  Word: { icon: File, tone: 'text-blue-600 dark:text-blue-400' },
  Spreadsheet: { icon: FileSpreadsheet, tone: 'text-green-600 dark:text-green-400' },
  Slides: { icon: Presentation, tone: 'text-orange-600 dark:text-orange-400' },
  Image: { icon: FileImage, tone: 'text-pink-600 dark:text-pink-400' },
  // Video and audio (a folder takes them since 20 October 2026), with the
  // channel feed's glyphs for the same files (channels/files/FileMark.tsx).
  Video: { icon: FilePlay, tone: 'text-indigo-600 dark:text-indigo-400' },
  Audio: { icon: FileMusic, tone: 'text-teal-600 dark:text-teal-400' },
};

export function entryLook(entry: FileListEntry): EntryLook {
  if (entry.type !== 'file') return LOOK[entry.type];
  return (entry.kind ? FILE_LOOK[entry.kind] : undefined) ?? { icon: File, tone: MUTED };
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The list's one column on a computer: "17 Oct" this year, "17 Oct 2025"
 * before it. `''` for a missing or unreadable time. `now` is the browser's
 * frozen clock, so no zero-argument `Date` runs in render.
 */
export function formatEntryDate(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  return date.getFullYear() === new Date(now).getFullYear()
    ? SHORT_DATE.format(date)
    : LONG_DATE.format(date);
}
