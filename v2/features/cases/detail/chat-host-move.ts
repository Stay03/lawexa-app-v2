/**
 * chat-host-move — moving the case chat's one rendered screen between frames
 * without losing where the reader was (Lucy, 25 October 2026).
 *
 * The case page and the statute reader draw their chat floating over the page
 * or docked beside it: two frames. The conversation screen used to be rendered
 * by each frame, so a move from one to the other unmounted it, and its stream
 * of the answer being written went with it. Now the page renders the screen
 * once, into a node of its own (case-chat-host.tsx), and the frame that shows
 * takes that node into its slot. React keeps the same screen; the DOM node only
 * changes parent.
 *
 * A node that leaves the document loses its scroll offsets, and the element
 * that had focus loses it. This module remembers both while the node is in a
 * frame (every scroll, and focus moving in and out) and puts them back after a
 * move. Pure, over the few element members it needs, so it is tested without
 * a browser.
 */

/** The members of an element this module reads and writes. */
export interface MovableElement {
  appendChild(child: MovableElement): unknown;
  contains(other: MovableElement | null): boolean;
  scrollTop: number;
  scrollLeft: number;
  focus?(options?: { preventScroll?: boolean }): void;
}

export interface ChatHostMemory {
  /** A scroll inside the node: remember where that element now stands. */
  onScroll(target: MovableElement): void;
  /** Focus came to an element inside the node. */
  onFocusIn(target: MovableElement): void;
  /**
   * Focus left an element inside the node. `next` is where it went (the event's
   * relatedTarget): only a move to somewhere outside the node clears the memory.
   * Focus going nowhere (`null`, as when the node leaves the document) keeps it,
   * so the move can put it back.
   */
  onFocusOut(next: MovableElement | null): void;
  /**
   * Put the node into `slot`, then restore the remembered scroll offsets and,
   * when focus was inside and nothing has taken it since (`activeIsBody`), the
   * focus. A no-op when the node is already in that slot.
   */
  attach(slot: MovableElement, activeIsBody: () => boolean, alreadyIn: boolean): void;
}

export function createChatHostMemory(node: MovableElement): ChatHostMemory {
  const offsets = new Map<MovableElement, { top: number; left: number }>();
  let focused: MovableElement | null = null;

  return {
    onScroll(target) {
      if (target !== node && !node.contains(target)) return;
      offsets.set(target, { top: target.scrollTop, left: target.scrollLeft });
    },
    onFocusIn(target) {
      if (node.contains(target)) focused = target;
    },
    onFocusOut(next) {
      if (next !== null && !node.contains(next)) focused = null;
    },
    attach(slot, activeIsBody, alreadyIn) {
      if (alreadyIn) return;
      slot.appendChild(node);
      for (const [element, offset] of offsets) {
        if (element !== node && !node.contains(element)) {
          offsets.delete(element);
          continue;
        }
        element.scrollTop = offset.top;
        element.scrollLeft = offset.left;
      }
      if (focused && node.contains(focused) && activeIsBody()) focused.focus?.({ preventScroll: true });
    },
  };
}
