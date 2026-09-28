import { buildTextIndex, locateQuote, type TextPiece } from './match';
import type { StatuteAnnotation } from '@/types/statute';

/**
 * The DOM half of placing a note: a part's rendered element walked into the
 * text pieces `match.ts` reads, and the answer turned into a `Range` the
 * highlight registry can paint.
 *
 * What counts as the part's text is what a reader sees and selects: the
 * renderer's own chrome (the section copy-link button, anything aria-hidden
 * or screen-reader only) is skipped, and every element that is not inline
 * text formatting is a block boundary, the server's "every other tag is one
 * space".
 */

/** Elements whose text never belongs to the law's words. */
const SKIP = 'button, [aria-hidden="true"], .sr-only';

/** Elements that are text formatting: zero width, as the server reads them. */
const INLINE = new Set(['EM', 'STRONG', 'I', 'B', 'U', 'SUP', 'SUB', 'SPAN', 'A']);

export function pieceWalk(root: Element): TextPiece<Text>[] {
  const pieces: TextPiece<Text>[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (text.data) pieces.push({ kind: 'text', text: text.data, handle: text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.matches(SKIP)) return;
    const block = !INLINE.has(el.tagName);
    if (block) pieces.push({ kind: 'break' });
    for (const child of el.childNodes) visit(child);
    if (block) pieces.push({ kind: 'break' });
  };
  visit(root);
  return pieces;
}

/** The page id of a part, as the reader stamps it (`akn-{eId}`). The note's
 *  `eid` is the export's eId, so the two always agree. */
export function noteAnchorId(eid: string): string {
  return `akn-${eid}`;
}

/** The rendered element of the part a note belongs to, when it is mounted. */
export function noteElement(annotation: StatuteAnnotation): Element | null {
  if (!annotation.node) return null;
  return document.getElementById(noteAnchorId(annotation.node.eid));
}

/**
 * The range a note's quote covers in its part, or null: the part is not
 * mounted yet, the note has no quote, or its words are not in the part's
 * text (the list says "text changed" then, from the server's own check).
 */
export function quoteRange(annotation: StatuteAnnotation, element: Element): Range | null {
  if (!annotation.quote) return null;
  const found = locateQuote(buildTextIndex(pieceWalk(element)), annotation.quote, {
    prefix: annotation.prefix,
    suffix: annotation.suffix,
    startOffset: annotation.start_offset,
  });
  if (!found) return null;
  const range = document.createRange();
  range.setStart(found.start.handle, found.start.offset);
  range.setEnd(found.end.handle, found.end.offset);
  return range;
}

/**
 * The range that marks a note with no quote: its part's number ("47.",
 * "(1)"), so a section-level note still has a place on the page. Null when
 * the part renders no number.
 */
export function numberRange(element: Element): Range | null {
  const num = element.querySelector('.akn-num, .akn-section-num');
  if (!num || !num.textContent?.trim()) return null;
  const range = document.createRange();
  range.selectNodeContents(num);
  return range;
}
