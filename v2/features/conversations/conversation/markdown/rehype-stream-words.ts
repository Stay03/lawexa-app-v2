import type { Element, Root, RootContent, Text } from 'hast';

/**
 * rehype-stream-words — the RENDER half of word-granularity streaming.
 *
 * WHY. Raising the publish rate buys nothing: text moves in whole characters, so a
 * 120Hz publish paints the same glyphs as a 60Hz one at twice the cost. The move
 * with the best smoothness-per-cost is the opposite — release WHOLE WORDS (the
 * smoother's `flow` landing policy) and let a compositor-only fade supply the
 * sub-word smoothness the lower publish rate gives up. At 140 cps with ~6-char
 * words that is ~23 publishes/second instead of ~60 (≈60% less markdown parse +
 * reconcile + layout), and it also fixes the half-drawn word that used to paint and
 * then jump to the next line when it finished and re-wrapped.
 *
 * HOW (Streamdown's shipped technique — `@streamdown/animate`, researched 2026-07).
 * A rehype transformer walks the HAST after markdown parsing and splits every text
 * node into per-word `<span class="v2-stream-word">` elements. The span carries a
 * CSS `@keyframes` opacity fade (see `v2/shell/shell.css`) which plays exactly once,
 * when the browser first creates the element.
 *
 * ONLY NEW WORDS ANIMATE — and no offset bookkeeping is needed to achieve it. The
 * mechanism is KEYS, not raw position: react-markdown renders through
 * `hast-util-to-jsx-runtime` with `passKeys: true`, which gives every ELEMENT child a
 * key of `tagName + '-' + its ordinal among same-named siblings` — so our spans are
 * keyed `span-0, span-1, span-2, …` within their parent. On a pure append (the
 * streaming case) those keys match one-for-one with the previous render, React reuses
 * the fibers and the DOM nodes, and a CSS animation that has already run does not
 * re-run. Only the appended spans are newly created, and a CSS animation plays on
 * creation.
 *
 * Two consequences follow from it being ordinal keys rather than content identity,
 * both benign and neither able to lose or duplicate text:
 *  - A mid-paragraph STRUCTURE change — a `**` closing into `<strong>`, a link
 *    closing — shifts the ordinals of the spans after it, so one word can end up
 *    reusing a fiber that had already animated and appear WITHOUT its fade. Never a
 *    double-fade, never a flash, never lost text.
 *  - A last-block ROOT type change (`<p>` becoming `<table>` or `<ol>` once the
 *    delimiter/marker line lands) remounts the block and replays its fades. Small in
 *    practice: the block is only a line or two old at that moment.
 *
 * This is still strictly more robust than deriving "what is new" from HAST `position`
 * offsets, which are ABSENT on the synthetic nodes remark-breaks/remark-gfm inject (a
 * `<br>`, a table cell wrapper): this walker never reads `position` at all, so there
 * is nothing to degrade from.
 *
 * ZERO OVERHEAD WHEN FINISHED. The plugin is not "disabled" on completion — it is
 * removed from the pipeline entirely (`MarkdownText`'s `animate` prop selects one of
 * two MODULE-LEVEL plugin arrays), so a finished message re-renders once with plain
 * text nodes and carries no spans at all.
 *
 * SKIPPED SUBTREES. Code and pre keep their exact text (a span between tokens would
 * fight syntax highlighting and `white-space: pre` handling); svg/math are foreign
 * content where an HTML span is invalid. Whitespace runs are left as plain text
 * nodes, so word spacing, `white-space` collapsing and line breaking are byte-for-
 * byte what react-markdown would have produced.
 */

const SKIP_TAGS = new Set(['code', 'pre', 'svg', 'math', 'style', 'script']);

/** The class the compositor-only fade is attached to (`v2/shell/shell.css`). */
const WORD_CLASS = 'v2-stream-word';

function wordSpan(word: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [WORD_CLASS] },
    children: [{ type: 'text', value: word }],
  };
}

/**
 * Split one text node into word spans + untouched whitespace text nodes, or `null`
 * when there is nothing worth wrapping (pure whitespace, or an empty value).
 */
function splitIntoWords(value: string): Array<Element | Text> | null {
  if (value === '' || value.trim() === '') return null;

  const pieces: Array<Element | Text> = [];
  const whitespace = /\s+/g;
  let last = 0;
  let match = whitespace.exec(value);
  while (match !== null) {
    if (match.index > last) pieces.push(wordSpan(value.slice(last, match.index)));
    pieces.push({ type: 'text', value: match[0] });
    last = match.index + match[0].length;
    match = whitespace.exec(value);
  }
  if (last < value.length) pieces.push(wordSpan(value.slice(last)));
  return pieces;
}

/**
 * Walk a children list, wrapping text and recursing into non-skipped elements.
 * Mutates in place (`splice`) so the array's own type never changes — `Element`
 * and `Text` are members of both `RootContent` and `ElementContent`.
 */
function transformChildren(children: RootContent[]): void {
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.type === 'text') {
      const pieces = splitIntoWords(child.value);
      if (pieces === null) continue;
      children.splice(i, 1, ...pieces);
      i += pieces.length - 1;
    } else if (child.type === 'element' && !SKIP_TAGS.has(child.tagName)) {
      transformChildren(child.children);
    }
  }
}

/**
 * The plugin factory. Referenced from a MODULE-LEVEL array in `MarkdownText` — a
 * fresh array (or a fresh factory call) per render would give every `MarkdownBlock`
 * a new prop identity and silently defeat the per-block `React.memo` that makes the
 * streaming pipeline cheap in the first place, turning a −60% into a large
 * regression.
 */
export function rehypeStreamWords() {
  return function transform(tree: Root): void {
    transformChildren(tree.children);
  };
}
