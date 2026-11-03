import type { SpaceRadarAffected } from '@/types/collab';
import type { PdfPassage } from '@/v2/features/files/pdf/pdf-passages';
import { viewKind, type ViewableFile } from '@/v2/features/files/viewable';

/**
 * linked-file — a link that names one file of a space (Arthur, 3 November
 * 2026: a Radar report's affected file "opens folder instead of the file
 * itself"). The server writes such links as `/spaces/{uuid}?tab=files&file={id}`
 * (Radar's affected items, the home timeline, the chat's file chips), and the
 * Space page read only the `tab`. Pure, so a test pins each rule.
 */

/** The file a link names (`&file=`), or `null` for none or for anything but a whole positive number. */
export function parseLinkedFileId(raw: string | null | undefined): number | null {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * What a link names: the file, and for a Radar report's affected file the
 * page it is affected on (`&page=`, 1-based) and the affected item
 * (`&affected=`, its uuid), whose read gives the passage to mark. The passage
 * itself never rides in the address: it is the file's own text.
 */
export interface LinkedFile {
  fileId: number;
  page: number | null;
  affected: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseLinkedFile(params: { file: string | null; page: string | null; affected: string | null }): LinkedFile | null {
  const fileId = parseLinkedFileId(params.file);
  if (fileId === null) return null;
  return {
    fileId,
    page: parseLinkedFileId(params.page),
    affected: params.affected && UUID.test(params.affected) ? params.affected : null,
  };
}

/**
 * Where the linked PDF opens and what it marks, in order, and which of them
 * the link was for. The affected item's read wins once it is in, when it is
 * about this file: its passages (every passage of that file in the report, in
 * its order, the clicked one among them; Arthur, 3 November 2026, option 2),
 * opened on the clicked one; from a server before that list, its one page
 * and quote. Until then, and when the read finds nothing (404) or speaks of
 * another file, the link's page with no mark; no page, nothing.
 */
export function linkedPassages(
  link: Pick<LinkedFile, 'fileId' | 'page'>,
  affected: SpaceRadarAffected | null,
): { passages: PdfPassage[]; start: number } {
  const fallback = { passages: link.page === null ? [] : [{ page: link.page, quote: null }], start: 0 };
  if (!affected || affected.file_id !== link.fileId) return fallback;
  const clicked: PdfPassage | null = affected.page === null ? null : { page: affected.page, quote: tidy(affected.quote) };
  const listed = (affected.passages ?? [])
    .filter((passage) => Number.isInteger(passage.page) && passage.page >= 1)
    .map((passage) => ({ page: passage.page, quote: tidy(passage.quote) }));
  if (listed.length > 0) {
    const at = clicked ? listed.findIndex((passage) => passage.page === clicked.page && passage.quote === clicked.quote) : -1;
    return { passages: listed, start: Math.max(0, at) };
  }
  return clicked ? { passages: [clicked], start: 0 } : fallback;
}

function tidy(quote: string | null | undefined): string | null {
  return quote?.trim() || null;
}

/**
 * Where a linked file opens, the way a tap on its row does: a PDF in the PDF
 * reader, a picture, a video or a recording in the space's viewer, and any
 * other file in the space's file card, whose "Open file" is its open.
 */
export type LinkedFileFrame = 'pdf' | 'gallery' | 'card';

export function linkedFileFrame(file: ViewableFile): LinkedFileFrame {
  const kind = viewKind(file);
  if (kind === 'pdf') return 'pdf';
  return kind === null ? 'card' : 'gallery';
}

/**
 * The note when the linked file does not open. 403 and 404 are the read's
 * own refusals (the file was removed, or the reader is not a member of its
 * space); anything else might work on a second try.
 */
export function linkedFileRefusal(status: number): string {
  if (status === 403 || status === 404) return 'This file isn’t available. It may have been removed, or you can’t open it.';
  return 'Couldn’t open the file. Please try the link again.';
}
