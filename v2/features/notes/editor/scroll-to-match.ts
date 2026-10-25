/**
 * Bring the find's current match to the middle of the part of its scroll area
 * the reader can see, by setting that area's `scrollTop` from measured boxes.
 *
 * Not `scrollIntoView`: on an iPhone (Arthur, 25 October 2026, Safari) the
 * draft did not move to the match at all, with the keyboard up or down, when
 * the find asked a decoration span inside the draft's nested scroller to
 * scroll itself into view. A plain `scrollTop` on the one area that scrolls
 * is the same on every browser.
 *
 * "The part the reader can see" is the area's box cut to the visual viewport:
 * on an iPhone the keyboard covers the bottom of a scroller that does not
 * shrink for it (the note page's), so the middle of the whole box can be
 * under the keyboard.
 */

/** The scrolling area, as measured. */
export interface ScrollArea {
  /** Top of the part of the area the reader can see, on screen (px). */
  top: number;
  /** Height of that visible part. */
  height: number;
  /** The area's own content box height (`clientHeight`): how far it can scroll is `scrollHeight` less this. */
  clientHeight: number;
  scrollTop: number;
  scrollHeight: number;
}

/** The match's box on screen. */
export interface MatchBox {
  top: number;
  height: number;
}

/**
 * The `scrollTop` that puts the match's middle at the middle of the visible
 * part, kept within what the area can scroll (never above its top, never
 * past its end).
 */
export function centredScrollTop(area: ScrollArea, match: MatchBox): number {
  const matchInContent = match.top - area.top + area.scrollTop;
  const target = matchInContent - (area.height - match.height) / 2;
  const furthest = Math.max(0, area.scrollHeight - area.clientHeight);
  return Math.round(Math.min(furthest, Math.max(0, target)));
}

/**
 * The visible part of a box running from `top` to `bottom` on screen, given
 * the visual viewport's top and bottom (the keyboard's top edge on a phone).
 * A box that is not on screen at all keeps its own extent.
 */
export function visibleSpan(top: number, bottom: number, viewTop: number, viewBottom: number): { top: number; height: number } {
  const from = Math.max(top, viewTop);
  const to = Math.min(bottom, viewBottom);
  return to > from ? { top: from, height: to - from } : { top, height: bottom - top };
}

/**
 * The nearest ancestor that scrolls vertically and has more to show than its
 * box: the chat draft's own scroll area, or the note page's (the shell's
 * content scroller), else the document itself. A table's own sideways
 * scroller is passed over, since it has no height to scroll.
 *
 * The search stops at a fixed box (the chat draft's sheet): nothing behind a
 * sheet is ever moved for a match inside it. `scrollIntoView` moved every
 * scroller up the tree, the chat page behind the sheet too, which is what
 * flickered behind Arthur's sheet on each search and arrow (25 October 2026).
 */
export function scrollAreaOf(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY, position } = window.getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    if (position === 'fixed') return null;
  }
  const page = document.scrollingElement;
  return page instanceof HTMLElement && page.scrollHeight > page.clientHeight ? page : null;
}

/** Moves the area that holds `match` so the match sits in the middle of what can be seen of it. */
export function scrollMatchToMiddle(match: HTMLElement): void {
  const area = scrollAreaOf(match);
  if (!area) return;
  const page = area === document.scrollingElement;
  const box = area.getBoundingClientRect();
  const boxTop = page ? 0 : box.top + area.clientTop;
  const boxBottom = page ? window.innerHeight : boxTop + area.clientHeight;
  const viewport = window.visualViewport;
  const viewTop = viewport ? viewport.offsetTop : 0;
  const viewBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  const seen = visibleSpan(boxTop, boxBottom, viewTop, viewBottom);
  const matchBox = match.getBoundingClientRect();
  const next = centredScrollTop(
    {
      top: seen.top,
      height: seen.height,
      clientHeight: page ? window.innerHeight : area.clientHeight,
      scrollTop: area.scrollTop,
      scrollHeight: area.scrollHeight,
    },
    { top: matchBox.top, height: matchBox.height },
  );
  if (next !== area.scrollTop) area.scrollTop = next;
}
