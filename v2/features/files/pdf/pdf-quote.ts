import { foldForMatch } from '@/lib/utils/quote-locator';

/**
 * pdf-quote — where a quoted passage sits in one PDF page's text layer (a
 * Radar report's affected file, opened on its page with the passage marked;
 * Arthur, 3 November 2026).
 *
 * WHY NOT THE CASE READER'S `locateQuote`: pdf.js lays a page's text out as one
 * span per run, with no character between one line and the next, and some
 * PDFs put no space between words at all. The case locator collapses spaces
 * but needs them, so "end of the\nline" would read "end of theline". Here both
 * sides drop whitespace, soft hyphens and hyphens altogether (a word broken at
 * a line's end reads whole), and fold quotes, dashes and case by the case
 * locator's own rule (`foldForMatch`). Every dropped character is 1:0, so a
 * hit still walks back to its text node and offset.
 *
 * Pure over an opaque handle (a DOM text node on the page, a plain value in
 * tests), like the statute notes' `match.ts`.
 */

export interface PdfTextPoint<H> {
  readonly handle: H;
  readonly offset: number;
}

export interface PdfTextIndex<H> {
  /** The page's characters as the match reads them. */
  readonly text: string;
  /** For every character of `text`, where it came from. */
  readonly points: readonly PdfTextPoint<H>[];
}

const SOFT_HYPHEN = '­';

/** The characters a match reads: not whitespace, not a hyphen (after the dash fold). */
function readChar(value: string, index: number): string | null {
  if (value[index] === SOFT_HYPHEN) return null;
  const { char, space } = foldForMatch(value, index);
  if (space || char === '-') return null;
  return char;
}

/** The page's text runs, in reading order, projected once. */
export function indexPdfText<H>(pieces: readonly { text: string; handle: H }[]): PdfTextIndex<H> {
  let text = '';
  const points: PdfTextPoint<H>[] = [];
  for (const { text: value, handle } of pieces) {
    for (let i = 0; i < value.length; i += 1) {
      const char = readChar(value, i);
      if (char === null) continue;
      text += char;
      points.push({ handle, offset: i });
    }
  }
  return { text, points };
}

/** The quote as the match reads it. */
export function projectQuote(quote: string): string {
  let out = '';
  for (let i = 0; i < quote.length; i += 1) {
    const char = readChar(quote, i);
    if (char !== null) out += char;
  }
  return out;
}

/**
 * The quote's first place on the page, start and end (the end one past its
 * last character, in that character's own run), or `null` when the page does
 * not have it. A quote of fewer than four characters marks nothing: with the
 * spaces gone, so short a run would be found inside other words.
 */
export function findPdfQuote<H>(
  index: PdfTextIndex<H>,
  quote: string,
): { start: PdfTextPoint<H>; end: PdfTextPoint<H> } | null {
  const needle = projectQuote(quote);
  if (needle.length < 4) return null;
  const at = index.text.indexOf(needle);
  if (at === -1) return null;
  const last = index.points[at + needle.length - 1];
  return { start: index.points[at], end: { handle: last.handle, offset: last.offset + 1 } };
}
