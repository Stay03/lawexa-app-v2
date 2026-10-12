/**
 * The phone case chat's drag guard: while the full-screen chat is open, a drag
 * that nothing inside the chat can scroll is cancelled, so iOS cannot pan the
 * visual viewport under the fixed card (12 October 2026).
 *
 * In Safari with the keyboard up the layout viewport is taller than the
 * visible one, and iOS scrolls that difference on any drag the page does not
 * use. Arthur's recording shows the whole visible area moving up about 95 px
 * during a drag inside the chat: the chat's bar left the top and a band of
 * the page showed under the composer. A fixed layer only holds still if its
 * own drags are cancelled wherever no scroller inside it can take them.
 *
 * WHAT STILL WORKS, and why:
 *
 *   - The message list, the new-chat list and any answer's wide table or code
 *     block scroll as before, momentum included: a drag is left alone while
 *     the element under the finger, or one of its ancestors in the card, can
 *     still scroll in the drag's direction, on either axis. Only at a
 *     scroller's end (and on the bar, the composer's frame, or a short list)
 *     is the drag cancelled, so it never chains out to the viewport.
 *   - The composer's own text scrolls when it has more lines than fit: the
 *     box is a scroller like any other.
 *   - Long-press selection and the copy menu: `touchstart` is never cancelled
 *     (it is listened to passively, only to know where the finger started),
 *     and while a selection inside the card is not collapsed, no drag is
 *     cancelled, so dragging a selection or its handles is untouched.
 *   - Pinch zoom: a drag with more than one finger is left alone.
 *
 * The decision is {@link blocksDrag}, a pure function of the scrollers under
 * the finger and the drag's step, pinned in case-chat-drag-guard.test.ts.
 * {@link guardChatDrags} is the DOM half; CaseAskDock adds it only while the
 * phone chat is open and removes it on close.
 */

/** One scroll container between the finger and the card, as measured now. */
export interface DragScroller {
  /** `overflow-y` is `auto` or `scroll`. */
  scrollsY: boolean;
  /** `overflow-x` is `auto` or `scroll`. */
  scrollsX: boolean;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

/** What one `touchmove` step is, for {@link blocksDrag}. */
export interface DragStep {
  /** Scroll containers from the touched element up to the card, innermost first. */
  chain: readonly DragScroller[];
  /** The finger's move since the last step, in CSS px: right and down are positive. */
  dx: number;
  dy: number;
  /** More than one finger is down (a pinch). */
  multiTouch: boolean;
  /** A selection inside the card is not collapsed (a long-press selection). */
  selecting: boolean;
}

/**
 * Less than this from an end counts as at the end. iOS reports fractional
 * scroll offsets, so a list at its bottom can read half a pixel short.
 */
const END_SLACK = 1;

/**
 * Whether one scroller can move its content the way the finger is going. A
 * finger moving down (`delta > 0`) brings earlier content into view, so the
 * scroller must not be at its start; moving up, not at its end.
 */
function canScroll(offset: number, size: number, view: number, delta: number): boolean {
  if (size - view < END_SLACK) return false;
  // `Math.abs`, because a right-to-left scroller counts its offset down from 0.
  const fromStart = Math.abs(offset);
  return delta > 0 ? fromStart >= END_SLACK : size - view - fromStart >= END_SLACK;
}

/**
 * Cancel this `touchmove`? Yes only when nothing under the finger can scroll
 * the way it is going. The step's larger component is the drag's direction,
 * so a mostly vertical drag over a wide table scrolls the list around it, and
 * a mostly sideways one scrolls the table.
 */
export function blocksDrag({ chain, dx, dy, multiTouch, selecting }: DragStep): boolean {
  if (multiTouch || selecting) return false;
  if (dx === 0 && dy === 0) return false;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const usable = chain.some((scroller) =>
    vertical
      ? scroller.scrollsY && canScroll(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight, dy)
      : scroller.scrollsX && canScroll(scroller.scrollLeft, scroller.scrollWidth, scroller.clientWidth, dx),
  );
  return !usable;
}

const SCROLLING = new Set(['auto', 'scroll']);

/** The scroll containers from `target` up to `card`, innermost first. */
function scrollersBetween(target: EventTarget | null, card: HTMLElement): DragScroller[] {
  const chain: DragScroller[] = [];
  let element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  while (element && card.contains(element)) {
    const style = getComputedStyle(element);
    const scrollsY = SCROLLING.has(style.overflowY);
    const scrollsX = SCROLLING.has(style.overflowX);
    if (scrollsY || scrollsX) {
      chain.push({
        scrollsY,
        scrollsX,
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      });
    }
    if (element === card) break;
    element = element.parentElement;
  }
  return chain;
}

/** A selection inside the card that is not collapsed. */
function selectingIn(card: HTMLElement): boolean {
  const selection = document.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.anchorNode && card.contains(selection.anchorNode));
}

/**
 * Listen for drags on `card` and cancel those {@link blocksDrag} says to.
 * `touchmove` is non-passive so it can be cancelled; `touchstart` is passive
 * and only records the finger. Returns the remover.
 */
export function guardChatDrags(card: HTMLElement): () => void {
  let lastX = 0;
  let lastY = 0;

  const onTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch) return;
    lastX = touch.clientX;
    lastY = touch.clientY;
  };

  const onTouchMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - lastX;
    const dy = touch.clientY - lastY;
    lastX = touch.clientX;
    lastY = touch.clientY;
    // Once iOS has started a scroll the event is not cancelable; leave it.
    if (!event.cancelable) return;
    const block = blocksDrag({
      chain: scrollersBetween(event.target, card),
      dx,
      dy,
      multiTouch: event.touches.length > 1,
      selecting: selectingIn(card),
    });
    if (block) event.preventDefault();
  };

  card.addEventListener('touchstart', onTouchStart, { passive: true });
  card.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => {
    card.removeEventListener('touchstart', onTouchStart);
    card.removeEventListener('touchmove', onTouchMove);
  };
}
