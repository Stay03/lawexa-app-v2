/**
 * Where a note's quoted words sit in a part's rendered text.
 *
 * The server checks a quote against the part's text with one rule (backend
 * 44b2655, `StatuteAnnotationAnchor`): inline tags (i, b, u, em, strong,
 * span, sup, sub, a) are zero width, every other tag counts as one space,
 * and every run of whitespace collapses to one space. The page must find the
 * quote by the SAME rule, or an underline would land where the server says
 * the words are not, or miss where it says they are.
 *
 * This file is the pure half: it takes the part's text as a list of pieces,
 * each a run of text with an opaque handle (a DOM text node on the page, a
 * plain value in tests) or a block boundary, and answers with the start and
 * end as (handle, offset) pairs. `note-ranges.ts` walks the DOM into pieces
 * and turns the answer into a `Range`.
 */

export type TextPiece<H> =
  | { readonly kind: 'text'; readonly text: string; readonly handle: H }
  | { readonly kind: 'break' };

export interface TextPoint<H> {
  readonly handle: H;
  readonly offset: number;
}

export interface TextIndex<H> {
  /** The part's text by the server's rule: whitespace runs and block
   *  boundaries are single spaces, and it is trimmed. */
  readonly text: string;
  /** For every character of `text`, where it came from. A space made by a
   *  block boundary points at the next real character. */
  readonly points: readonly TextPoint<H>[];
}

const WHITESPACE = /\s/;

/** Collapse whitespace the server's way, for a quote or a prefix/suffix. */
export function normalizeQuote(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildTextIndex<H>(pieces: readonly TextPiece<H>[]): TextIndex<H> {
  let text = '';
  const points: TextPoint<H>[] = [];
  // A space is owed (from whitespace or a block boundary) but not yet
  // written: it is written only when real text follows, which is what trims
  // both ends and collapses runs.
  let pendingSpace = false;

  for (const piece of pieces) {
    if (piece.kind === 'break') {
      pendingSpace = text.length > 0;
      continue;
    }
    const { text: data, handle } = piece;
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      if (WHITESPACE.test(ch)) {
        pendingSpace = text.length > 0;
        continue;
      }
      if (pendingSpace) {
        text += ' ';
        points.push({ handle, offset: i });
        pendingSpace = false;
      }
      text += ch;
      points.push({ handle, offset: i });
    }
  }
  return { text, points };
}

export interface QuoteHints {
  readonly prefix?: string | null;
  readonly suffix?: string | null;
  readonly startOffset?: number | null;
}

/**
 * The start and end of `quote` in the index, or null when the words are not
 * there. The end is exclusive: one past the quote's last character, in that
 * character's own text piece.
 *
 * When the quote occurs more than once, the hints choose: an occurrence whose
 * surrounding text matches the stored prefix and suffix first, then the one
 * nearest the stored start offset, then the first. Imported notes carry no
 * hints, and the first occurrence is what the import meant.
 */
export function locateQuote<H>(
  index: TextIndex<H>,
  quote: string,
  hints: QuoteHints = {},
): { start: TextPoint<H>; end: TextPoint<H> } | null {
  const needle = normalizeQuote(quote);
  if (!needle) return null;

  const starts: number[] = [];
  for (let at = index.text.indexOf(needle); at !== -1; at = index.text.indexOf(needle, at + 1)) {
    starts.push(at);
  }
  if (starts.length === 0) return null;

  const pick = chooseOccurrence(index.text, starts, needle.length, hints);
  const last = index.points[pick + needle.length - 1];
  return {
    start: index.points[pick],
    end: { handle: last.handle, offset: last.offset + 1 },
  };
}

function chooseOccurrence(
  text: string,
  starts: readonly number[],
  length: number,
  hints: QuoteHints,
): number {
  if (starts.length === 1) return starts[0];

  const prefix = hints.prefix ? normalizeQuote(hints.prefix) : '';
  const suffix = hints.suffix ? normalizeQuote(hints.suffix) : '';
  if (prefix || suffix) {
    const fitting = starts.filter((at) => {
      const before = normalizeQuote(text.slice(Math.max(0, at - prefix.length - 1), at));
      const after = normalizeQuote(text.slice(at + length, at + length + suffix.length + 1));
      return (!prefix || before.endsWith(prefix)) && (!suffix || after.startsWith(suffix));
    });
    if (fitting.length > 0) return fitting[0];
  }

  if (typeof hints.startOffset === 'number') {
    const target = hints.startOffset;
    return starts.reduce((best, at) =>
      Math.abs(at - target) < Math.abs(best - target) ? at : best,
    );
  }

  return starts[0];
}

/** The server's limits on a new note's quote and its context (StoreStatuteAnnotationRequest). */
export const QUOTE_MAX = 2000;
export const CONTEXT_MAX = 100;
/** How much surrounding text a new note keeps to tell repeats apart. */
const CONTEXT_CHARS = 60;

export interface QuoteDraft {
  readonly quote: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

/**
 * The quote a reader selected, with the words either side of it, read from
 * the part's text by the server's rule. `start` is where the selection
 * begins in that text; when the selection's own text is not found there
 * (a stray character at an edge), the first occurrence stands in.
 */
export function quoteDraft<H>(index: TextIndex<H>, selected: string, start: number): QuoteDraft | null {
  const quote = normalizeQuote(selected);
  if (!quote || quote.length > QUOTE_MAX) return null;
  const at = index.text.startsWith(quote, start) ? start : index.text.indexOf(quote);
  if (at === -1) return null;
  const end = at + quote.length;
  return {
    quote,
    prefix: index.text.slice(Math.max(0, at - CONTEXT_CHARS), at).trimStart().slice(-CONTEXT_MAX),
    suffix: index.text.slice(end, end + CONTEXT_CHARS).trimEnd().slice(0, CONTEXT_MAX),
    startOffset: at,
    endOffset: end,
  };
}
