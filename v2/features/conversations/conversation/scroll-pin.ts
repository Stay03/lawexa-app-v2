/**
 * Whether a chat's view still counts as pinned to its newest message, read in
 * the list's scroll handler (MessageList.tsx).
 *
 * WHY A POSITION AND NOT A FLAG (Spaces F4 review S2). The list writes
 * `scrollTop` itself: the open's landing, the bottom-follow, a send, a block
 * swap's fix. The scroll event a write fires arrives later, after the page
 * under the view may have grown again (the dock's measured height replacing
 * its fallback, author lines, the activity row). Read by distance alone, that
 * event looked like the reader scrolling away and detached the view for good,
 * with the "Latest" pill showing on a chat the reader never moved. So the list
 * records the position of its own last write; an event that finds the view
 * still there is the list's own scroll, or growth under a view nobody moved.
 * A flag would go stale on a write that moves nothing (no event fires) and a
 * counter would overcount when a frame folds several events into one.
 */
export interface ScrollReading {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * At the bottom within `threshold`, or still pinned because the view sits
 * where the list last put it (`ownTop`) and only the page under it grew. A
 * view that was already detached stays detached at the list's own position:
 * a block swap's fix while the reader is scrolled up keeps their place
 * without re-attaching them.
 */
export function readsAtBottom(
  reading: ScrollReading,
  ownTop: number | null,
  wasAtBottom: boolean,
  threshold: number,
  lastTop: number | null = null,
): boolean {
  // A detached reader the browser clamped to the bottom (the page shrank under
  // them) stays detached: they were further down than the new bottom, which no
  // scroll of theirs can do. Their own scroll down to the bottom re-attaches.
  if (!wasAtBottom && clampedToBottom(reading, lastTop)) return false;
  const distance = reading.scrollHeight - reading.scrollTop - reading.clientHeight;
  if (distance <= threshold) return true;
  return wasAtBottom && ownTop !== null && reading.scrollTop === ownTop;
}

/** Within a pixel of the page's bottom. On a fractional device-pixel ratio
 *  (an iPhone's 3x, Android's 2.625x) a view at the bottom can read a
 *  fraction short of it, so an exact comparison would miss. */
export function nearBottom(reading: ScrollReading): boolean {
  return Math.abs(reading.scrollTop - (reading.scrollHeight - reading.clientHeight)) <= 1;
}

/** The view sits at the page's bottom after being further down than that
 *  bottom allows (`lastTop`, where the last scroll event found it): a clamp. */
export function clampedToBottom(reading: ScrollReading, lastTop: number | null): boolean {
  const bottom = reading.scrollHeight - reading.clientHeight;
  return lastTop !== null && nearBottom(reading) && lastTop > bottom + 1;
}

/** What the list does when its content changes size (its ResizeObserver). */
export interface ResizeFollow {
  /** The position the list now calls its own. */
  ownTop: number | null;
  /** Snap here before this frame paints, or null. */
  snapTo: number | null;
  /** Glide the rest of the way over the next frames. */
  ease: boolean;
}

/**
 * The list's answer to a size change, for a PINNED view only: a detached
 * reader is left exactly where they are, with no snap and no change to the
 * list's own position, even when a shrink has clamped them to the bottom.
 *
 * A pinned view the browser clamped (the page shrank under it, as when the
 * open's estimated rows are drawn at their real height on the first frame)
 * sits at the page's bottom, a position the list never wrote. A clamp can
 * only end at the bottom, so that position becomes the list's own, and the
 * scroll event the clamp fires reads as the list's (`readsAtBottom`). Growth
 * past the threshold snaps here, before paint; smaller growth glides.
 */
export function followOnResize(
  reading: ScrollReading,
  ownTop: number | null,
  atBottom: boolean,
  threshold: number,
): ResizeFollow {
  if (!atBottom) return { ownTop, snapTo: null, ease: false };
  const bottom = reading.scrollHeight - reading.clientHeight;
  // The position as read, not `bottom`: the scroll event that follows reads
  // the same value, and `readsAtBottom` compares the two exactly.
  const own = nearBottom(reading) ? reading.scrollTop : ownTop;
  // A pinned view is followed wherever it sits: the scroll handler already
  // read it as pinned (a reader's nudge under the threshold, a smooth scroll
  // that landed short of a page that grew during it), and a reader's scroll
  // away is dispatched before this observer, so it has already detached.
  const gap = bottom - reading.scrollTop;
  if (gap > threshold) return { ownTop: own, snapTo: bottom, ease: false };
  return { ownTop: own, snapTo: null, ease: gap > 1 };
}
