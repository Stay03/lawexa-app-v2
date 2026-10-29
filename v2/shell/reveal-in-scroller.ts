/**
 * Bring a focused field into view inside its own scrolling box, once the
 * on-screen keyboard has finished moving (Arthur, 29 October 2026, 21:13Z,
 * thread 7aa0c6d8: on his iPhone the keyboard covered the task sheet's fields
 * below the Title).
 *
 * The sheet that holds the field already sits on the keyboard (it is placed
 * from `--visual-top` and `--visual-height`, use-keyboard-inset.ts), so its
 * scrolling body shrinks as the keyboard rises. A field low in that body can
 * end up under the sheet's footer or past the body's bottom. Only the body is
 * scrolled: `scrollIntoView` would also scroll the locked page, which iOS does
 * not always put back.
 */

/** Space kept between the field and the edge of the scrolling box. */
export const REVEAL_MARGIN_PX = 16;

/** How long to wait for the keyboard when no viewport resize comes: the
 *  keyboard was already up (the reader moved from one field to the next), or
 *  the browser has no visual viewport. */
export const REVEAL_FALLBACK_MS = 250;

/** After the last viewport resize, how long it must stay still before the
 *  keyboard counts as settled. Some browsers send a resize per animation step. */
export const REVEAL_SETTLE_MS = 120;

/** The longest a reveal waits, however many resizes come. */
export const REVEAL_MAX_WAIT_MS = 1000;

export interface ScrollBox {
  scrollTop: number;
  top: number;
  bottom: number;
}

export interface FieldEdges {
  top: number;
  bottom: number;
}

/**
 * The box's new `scrollTop` so the field shows whole inside it, moving as
 * little as possible. A field taller than the box shows from its top. Both
 * rectangles are in the same coordinates (viewport pixels from
 * `getBoundingClientRect`). Never below 0.
 */
export function scrollTopToReveal(box: ScrollBox, field: FieldEdges, margin: number = REVEAL_MARGIN_PX): number {
  const visibleTop = box.top + margin;
  const visibleBottom = box.bottom - margin;
  if (field.top < visibleTop) return Math.max(0, box.scrollTop - (visibleTop - field.top));
  if (field.bottom > visibleBottom) {
    // Down by what is hidden, but never so far that the field's top goes past
    // the box's top.
    const down = Math.min(field.bottom - visibleBottom, field.top - visibleTop);
    return Math.max(0, box.scrollTop + down);
  }
  return box.scrollTop;
}

/** A field that raises the on-screen keyboard or the phone's picker. */
export function takesKeyboard(target: EventTarget | null): target is HTMLElement {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'hidden', 'range', 'color', 'file', 'image'].includes(
      target.type,
    );
  }
  return target.isContentEditable;
}

/**
 * Wait for the keyboard to settle, then scroll `box` so `field` shows. Returns
 * a cancel function; call it when another field takes focus or the box goes.
 * Does nothing if the field lost focus or left the page in the meantime.
 */
export function revealAfterKeyboard(box: HTMLElement, field: HTMLElement): () => void {
  const viewport = window.visualViewport;
  let timer = 0;
  let limit = 0;
  let finished = false;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    window.clearTimeout(limit);
    viewport?.removeEventListener('resize', onResize);
    if (!box.isConnected || !field.isConnected || document.activeElement !== field) return;
    const boxRect = box.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    const next = scrollTopToReveal(
      { scrollTop: box.scrollTop, top: boxRect.top, bottom: boxRect.bottom },
      { top: fieldRect.top, bottom: fieldRect.bottom },
    );
    if (next === box.scrollTop) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    box.scrollTo({ top: next, behavior: still ? 'auto' : 'smooth' });
  };

  const onResize = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(finish, REVEAL_SETTLE_MS);
  };

  timer = window.setTimeout(finish, REVEAL_FALLBACK_MS);
  limit = window.setTimeout(finish, REVEAL_MAX_WAIT_MS);
  viewport?.addEventListener('resize', onResize);

  return () => {
    finished = true;
    window.clearTimeout(timer);
    window.clearTimeout(limit);
    viewport?.removeEventListener('resize', onResize);
  };
}
