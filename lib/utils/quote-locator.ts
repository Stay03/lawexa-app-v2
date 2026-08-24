/**
 * Finding a passage inside rendered case text and handing back a DOM Range.
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────────
 * A reviewer approving an extracted principle has to check it against the
 * judgment it came from. Showing them the judgment is not enough — a Supreme
 * Court report runs to 235,000 characters and the passage is one paragraph of
 * it. So the passage is located and scrolled to.
 *
 * ── WHY MATCHING IS NOT `indexOf` ─────────────────────────────────────────
 * The text being searched and the text being searched FOR come from different
 * places and disagree about characters that look identical on screen:
 *
 *   - judgments written in Word carry curly quotes and long dashes, and our
 *     extractors do not agree with each other about them, so "the plaintiff's
 *     claim" can differ by one invisible character;
 *   - the stored markup is broken across `<p>`, `<em>` and links, so a passage
 *     routinely spans several text nodes;
 *   - whitespace differs: the stored source has newlines where the DOM has
 *     nothing at all.
 *
 * So both sides are projected through the SAME normalisation — the contract
 * agreed with the backend, steps 3 to 7. Steps 1 and 2, stripping tags and
 * decoding entities, are already done by the browser: a text node contains
 * neither.
 *
 * ── THE ONE PROPERTY THAT MAKES THIS WORK ─────────────────────────────────
 * Every step is 1:1 or 1:0 on characters, so a hit in the projection walks
 * straight back to the text node and offset it came from. The backend applies
 * one further step internally — dropping punctuation before scoring — and this
 * side must NOT copy it, because dropping characters destroys that mapping.
 *
 * ── THE RULE THE WRITTEN CONTRACT DOES NOT STATE ──────────────────────────
 * Between two paragraphs the stored markup has a newline, which the backend's
 * projection collapses to a space. The DOM has no character at all between one
 * paragraph and the next. Without a block boundary emitting a space, the page
 * reads `provides:(1) if` where the quote reads `provides: (1) if`.
 * Measured on real data: 13 of 144 principles missed for exactly this, every
 * one of them a holding that runs across a paragraph break.
 * Inline elements must NOT trigger it, or a linked case name mid-sentence
 * inserts a phantom space and breaks the match the other way.
 */

/** Whitespace that collapses to a single space (contract step 3). */
function isSpace(code: number): boolean {
  return (
    code === 0x20 ||
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0d ||
    code === 0x00a0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/** Curly quotes fold to straight ones (contract step 4). */
const QUOTES: Record<number, string> = {
  0x2018: "'",
  0x2019: "'",
  0x201c: '"',
  0x201d: '"',
};

/** The dash family folds to a plain hyphen (contract step 5). */
function isDash(code: number): boolean {
  return code >= 0x2010 && code <= 0x2015;
}

/** Elements that sit INSIDE a line of prose and so are not block boundaries. */
const INLINE = new Set([
  'A', 'EM', 'STRONG', 'B', 'I', 'U', 'SPAN', 'SUP', 'SUB', 'CODE', 'SMALL', 'MARK', 'ABBR',
]);

function blockOf(node: Node): Element | null {
  let el = node.parentElement;
  while (el && INLINE.has(el.tagName)) el = el.parentElement;
  return el;
}

function foldChar(value: string, index: number): string {
  const code = value.charCodeAt(index);
  const quote = QUOTES[code];
  if (quote) return quote;
  if (isDash(code)) return '-';
  return value[index];
}

/** Contract steps 3 to 7 on a plain string — used for the text being sought. */
export function normalizeForMatch(value: string): string {
  let out = '';
  let pendingSpace = false;
  for (let i = 0; i < value.length; i += 1) {
    if (isSpace(value.charCodeAt(i))) {
      pendingSpace = true;
      continue;
    }
    if (pendingSpace && out.length > 0) out += ' ';
    pendingSpace = false;
    out += foldChar(value, i).toLowerCase();
  }
  return out;
}

/**
 * A rendered container projected once, with the map back to the DOM.
 *
 * `nodeIds` and `offsets` are parallel to `text`: character `n` of the
 * projection came from `nodes[nodeIds[n]]` at `offsets[n]`.
 */
export interface RenderedIndex {
  text: string;
  nodes: Text[];
  nodeIds: Int32Array;
  offsets: Int32Array;
}

/**
 * Build the index. Costs about 130ms on a 235KB judgment on a throttled
 * phone-class CPU, so it is built lazily on the first lookup and never on page
 * load.
 */
export function indexRendered(root: Node): RenderedIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const chunks: string[] = [];
  const nodeIds: number[] = [];
  const offsets: number[] = [];
  let pendingSpace = false;
  let block: Element | null = null;

  let node = walker.nextNode() as Text | null;
  while (node) {
    const value = node.nodeValue;
    if (value) {
      const nodeBlock = blockOf(node);
      if (nodeBlock !== block) {
        block = nodeBlock;
        if (chunks.length > 0) pendingSpace = true;
      }
      const id = nodes.push(node) - 1;
      for (let i = 0; i < value.length; i += 1) {
        if (isSpace(value.charCodeAt(i))) {
          pendingSpace = true;
          continue;
        }
        if (pendingSpace && chunks.length > 0) {
          chunks.push(' ');
          nodeIds.push(id);
          offsets.push(i);
        }
        pendingSpace = false;
        chunks.push(foldChar(value, i).toLowerCase());
        nodeIds.push(id);
        offsets.push(i);
      }
    }
    node = walker.nextNode() as Text | null;
  }

  return {
    text: chunks.join(''),
    nodes,
    nodeIds: Int32Array.from(nodeIds),
    offsets: Int32Array.from(offsets),
  };
}

/**
 * Is this hit a whole-word match, rather than a run that happens to sit inside
 * longer words at either end?
 *
 * ── A SUBSTRING SEARCH FINDS PASSAGES THE JUDGMENT NEVER WROTE ────────────
 * `indexOf` matched "act confers the right to" inside "enact confers the right
 * to". The Range then began part-way through "enact", so the reviewer would
 * have been shown a highlight starting mid-word — and, where a sub-word run
 * occurred somewhere else entirely, a passage from the wrong part of the
 * judgment while the row claimed a perfect match.
 *
 * @backendclaude hit the same flaw in the scorer and found it by chasing a
 * principle that scored 100 and produced no quote at all.
 *
 * Checked rather than padded: padding the projection would shift every offset
 * and break the map back to the DOM, which is the one property this file
 * exists to preserve.
 *
 * ── THE BOUNDARY IS NOT A SPACE, AND ASSUMING IT WAS COST 20 PASSAGES ─────
 * The first version of this asked for a space on each side. That is wrong for
 * the text this runs on: a passage that ends a sentence is followed by a full
 * stop, and a quoted holding is wrapped in quotation marks. Measured over 149
 * real principles in four judgments, demanding a space threw away 20 passages
 * that were present and correct — seven wrapped in quotation marks, four ending
 * on a dash, the rest on a colon or a comma.
 *
 * A cut is only INSIDE a word when the characters on both sides of it are word
 * characters. That is the rule below, and it is the one that discriminates:
 * "act confers the right to" is still refused inside "enact confers the right
 * to", because 'a' and the preceding 'n' are both letters. Same corpus, same
 * run: 148 of 149 located, and the one refusal is a genuine mid-word cut where
 * the judgment itself is missing a space.
 */
function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

function isWordAligned(text: string, at: number, length: number): boolean {
  const end = at + length;
  const startsCleanly = at === 0 || !(isWordChar(text[at]) && isWordChar(text[at - 1]));
  const endsCleanly = end === text.length || !(isWordChar(text[end - 1]) && isWordChar(text[end]));
  return startsCleanly && endsCleanly;
}

function rangeAt(index: RenderedIndex, at: number, length: number): Range {
  const last = at + length - 1;
  const range = document.createRange();
  range.setStart(index.nodes[index.nodeIds[at]], index.offsets[at]);
  range.setEnd(index.nodes[index.nodeIds[last]], index.offsets[last] + 1);
  return range;
}

/**
 * The passage, as a Range, or `null` when this text does not contain it.
 *
 * A Range spans elements natively, which matters: a third of real principles
 * cross an inline link or an italicised case name partway through.
 */
export function locateQuote(index: RenderedIndex, quote: string): Range | null {
  const needle = normalizeForMatch(quote);
  if (!needle) return null;
  let at = index.text.indexOf(needle);
  while (at !== -1) {
    if (isWordAligned(index.text, at, needle.length)) {
      return rangeAt(index, at, needle.length);
    }
    at = index.text.indexOf(needle, at + 1);
  }
  return null;
}

/**
 * Every occurrence, capped.
 *
 * Measured zero ambiguous matches across 149 real principles, but a quote that
 * appears twice in its own judgment is possible and the screen should say so
 * rather than silently pick the first.
 */
export function locateAllQuotes(index: RenderedIndex, quote: string, cap = 8): Range[] {
  const needle = normalizeForMatch(quote);
  if (!needle) return [];
  const found: Range[] = [];
  let at = index.text.indexOf(needle);
  while (at !== -1 && found.length < cap) {
    if (isWordAligned(index.text, at, needle.length)) {
      found.push(rangeAt(index, at, needle.length));
    }
    at = index.text.indexOf(needle, at + 1);
  }
  return found;
}
