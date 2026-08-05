import type { ChannelFile } from '@/types/collab';
import { isArchiveFile } from '../model';

/**
 * file-model — the pure vocabulary of the channel file library: what KIND a
 * file is, which lenses the library offers, and when it is worth offering
 * them. No JSX and no hooks, so the rows, the mark, the filter strip and the
 * skeleton all classify a file the same way.
 *
 * ── MIME WINS, EXTENSION IS THE FALLBACK ───────────────────────────────────
 * The server content-sniffs on upload, so `mime_type` is the checked fact and
 * the file name is only a hint — but generic mimes (`application/octet-stream`
 * from some clients) do arrive, and then the extension is all there is.
 */

export type FileKind =
  | 'image'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'other';

/** Lowercased extension, or `''` for a name with no dot. */
function extensionOf(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? (parts.pop() ?? '') : '';
}

/**
 * Whether the browser can be asked to PAINT this file. Deliberately narrower
 * than "the mime starts with image/": the thumbnail path is only taken for the
 * formats the upload allow-list admits and every engine renders, so a future
 * `image/tiff` cannot become a permanently broken 40px box.
 */
export function isRenderableImage(file: Pick<ChannelFile, 'mime_type' | 'original_name'>): boolean {
  const mime = file.mime_type.toLowerCase();
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)) return true;
  return (
    mime.startsWith('image/') &&
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extensionOf(file.original_name))
  );
}

/** Which bucket a file belongs to. Archive is decided by the shared rule in
 *  `../model`, because the same predicate also governs the zip obligations. */
export function fileKind(file: Pick<ChannelFile, 'mime_type' | 'original_name'>): FileKind {
  const mime = file.mime_type.toLowerCase();
  const ext = extensionOf(file.original_name);

  if (isRenderableImage(file) || mime.startsWith('image/')) return 'image';
  if (isArchiveFile(file.mime_type, file.original_name)) return 'archive';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    ['csv', 'xlsx', 'xls'].includes(ext)
  ) {
    return 'spreadsheet';
  }
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['pptx', 'ppt'].includes(ext)
  ) {
    return 'presentation';
  }
  if (
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime === 'application/rtf' ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

/** The plural label a filter tab wears. */
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  image: 'Images',
  document: 'Documents',
  spreadsheet: 'Sheets',
  presentation: 'Slides',
  archive: 'Archives',
  other: 'Other',
};

/** Fixed tab order, so the strip does not reshuffle as files arrive. */
const KIND_ORDER: readonly FileKind[] = [
  'document',
  'image',
  'spreadsheet',
  'presentation',
  'archive',
  'other',
];

export type FileLens = 'all' | FileKind;

/**
 * WHEN THE LIBRARY IS BIG ENOUGH TO NEED FILTERING. Below this, the filter
 * strip is chrome over a list you can already see in one glance — and a strip
 * that appears and disappears as a channel grows is far less confusing than
 * one that is permanently there doing nothing.
 */
export const FILE_FILTER_MIN_ROWS = 8;

/**
 * The lenses this library can actually offer: `All`, plus one tab per kind
 * PRESENT in it. Returns an empty array when there is nothing to filter (fewer
 * than {@link FILE_FILTER_MIN_ROWS} files, or every file the same kind — a
 * two-tab strip whose second tab selects everything is a decoration).
 */
export function fileLenses(
  files: readonly ChannelFile[],
): readonly { id: FileLens; label: string }[] {
  if (files.length < FILE_FILTER_MIN_ROWS) return [];
  const present = new Set<FileKind>();
  for (const file of files) present.add(fileKind(file));
  if (present.size < 2) return [];
  return [
    { id: 'all', label: 'All' },
    ...KIND_ORDER.filter((kind) => present.has(kind)).map((kind) => ({
      id: kind,
      label: FILE_KIND_LABEL[kind],
    })),
  ];
}

/**
 * The lens the strip should actually show. A selected kind can STOP EXISTING
 * while the reader is looking at it — the last image is deleted, or the strip
 * disappears entirely because the library dropped below the threshold — and a
 * tab that selects nothing would leave the panel permanently empty with no
 * visible cause. Resolving it in render rather than correcting it in an effect
 * is what keeps this a derivation instead of a state loop (React Compiler
 * lint bans the effect form outright).
 */
export function resolveFileLens(
  selected: FileLens,
  lenses: readonly { id: FileLens }[],
): FileLens {
  return lenses.some((lens) => lens.id === selected) ? selected : 'all';
}
