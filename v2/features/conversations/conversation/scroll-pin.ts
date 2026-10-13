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
): boolean {
  const distance = reading.scrollHeight - reading.scrollTop - reading.clientHeight;
  if (distance <= threshold) return true;
  return wasAtBottom && ownTop !== null && reading.scrollTop === ownTop;
}
