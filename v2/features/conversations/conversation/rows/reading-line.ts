/**
 * reading-line — the line under a document the person attached in a chat,
 * saying how far the server has got with reading its text (Stay, thread
 * 4b936d0d; techlead's answer 77b174df; Backend's field on `chat-no-extract`,
 * 2 November 2026). The chat never waits for the reading: the message goes at
 * once, and this line says what happened to the file afterwards.
 *
 * The state is the file's own `extraction_status` from `GET /files/{id}`. A
 * message's attachment list is written once when the message is sent and
 * never updates, so it cannot carry this.
 *
 *   pending   "Reading…"; with `pages_read` and `page_count` (a later
 *             server), "Reading… 120 of 1,600 pages"
 *   done      "Read"
 *   failed    "Couldn't read this file" (the file stays in their files)
 *   empty     "No text to read in this file"
 *   skipped   the same: a file with no text the server can read
 *
 * A SCAN HAS NO TEXT OF ITS OWN, so its extraction is `empty` while its pages
 * are read as pictures (`ocr_status`, live since the scanned-page reading).
 * For an empty or skipped file the scan's state decides (techlead's review,
 * 2 November 2026): `pending` is still "Reading…", `done` or `partial` (pages
 * read, some perhaps past the plan) is "Read", and `failed` or no scan is "No
 * text to read in this file". A mixed PDF (typed pages and scanned ones)
 * is `done` while its scanned pages are still read, so `done` with the scan
 * `pending` is "Reading…" too.
 *
 * A server without the field shows no line. No React, so node:test reads it.
 */
export type ExtractionStatus = 'pending' | 'done' | 'empty' | 'failed' | 'skipped';

export interface ReadingFacts {
  extraction_status?: ExtractionStatus | null;
  ocr_status?: 'pending' | 'done' | 'partial' | 'failed' | null;
  pages_read?: number | null;
  page_count?: number | null;
}

export interface ReadingLine {
  text: string;
  /** `reading` shows a spinner; `failed` reads as a warning; `settled` is quiet. */
  tone: 'reading' | 'settled' | 'failed';
  /** What a screen reader hears: the same while reading, so a count is not re-announced. */
  announce: string;
}

const count = (n: number) => n.toLocaleString('en-GB');

const READING_ANNOUNCE = 'Reading the file.';
const READ: ReadingLine = { text: 'Read', tone: 'settled', announce: 'The file is read.' };
const NO_TEXT: ReadingLine = { text: 'No text to read in this file', tone: 'settled', announce: 'No text to read in this file.' };

function wholeNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function readingLine(facts: ReadingFacts | null | undefined): ReadingLine | null {
  switch (facts?.extraction_status) {
    case 'pending': {
      const read = wholeNumber(facts.pages_read);
      const total = wholeNumber(facts.page_count);
      const text = read !== null && total !== null && total > 0
        ? `Reading… ${count(Math.min(read, total))} of ${count(total)} ${total === 1 ? 'page' : 'pages'}`
        : 'Reading…';
      return { text, tone: 'reading', announce: READING_ANNOUNCE };
    }
    case 'done':
      // A mixed PDF: its typed pages are read, its scanned ones may not be yet.
      if (facts.ocr_status === 'pending') return { text: 'Reading…', tone: 'reading', announce: READING_ANNOUNCE };
      return READ;
    case 'failed':
      return { text: 'Couldn’t read this file', tone: 'failed', announce: 'Couldn’t read this file.' };
    case 'empty':
    case 'skipped':
      // A scan: its pages decide.
      if (facts.ocr_status === 'pending') return { text: 'Reading…', tone: 'reading', announce: READING_ANNOUNCE };
      if (facts.ocr_status === 'done' || facts.ocr_status === 'partial') return READ;
      return NO_TEXT;
    default:
      return null;
  }
}

/**
 * What the live region says. The reading's start, and its end only when the
 * file was asked about more than once: an old message whose file was read
 * long ago says nothing when the chat opens.
 */
export function readingAnnouncement(line: ReadingLine | null, answers: number): string {
  if (!line) return '';
  if (line.tone === 'reading') return line.announce;
  return answers > 1 ? line.announce : '';
}

export function isReading(facts: ReadingFacts | null | undefined): boolean {
  return readingLine(facts)?.tone === 'reading';
}

/**
 * How long to wait before asking again, after `asked` answers so far: 2 s,
 * then half as long again each time, up to 15 s. A short file is read in
 * seconds; a 1,600-page book takes minutes and need not be asked every 2 s.
 */
export function readingPollDelay(asked: number): number {
  return Math.min(15_000, Math.round(2_000 * 1.5 ** Math.max(0, asked - 1)));
}
