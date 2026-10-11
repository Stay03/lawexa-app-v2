/**
 * Keeping the reader's place when deferred blocks swap to parsed markdown
 * (defer-plan.ts), in a browser without scroll anchoring.
 *
 * The deferred blocks of an answer are its first ones, so they form one
 * region at the top of the answer, and a parsed block is rarely the exact
 * height of its raw text. Chrome and Firefox absorb the change with CSS scroll
 * anchoring. Safari has none (v2/runtime/scroll-anchoring.ts): `scrollTop`
 * keeps its number and everything below the region moves by the change. So,
 * only where anchoring is missing, the swap's layout effect moves `scrollTop`
 * by the part of the change that happened above the viewport's top edge, or
 * pins a reader who was at the bottom back to the bottom.
 */

/** The deferred region as it stood just before the swap. */
export interface PendingRegion {
  /** Its top, in the scroller's content coordinates. */
  top: number;
  /** Its height while it held placeholders. */
  height: number;
  /** The scroller's `scrollTop` at that moment. */
  scrollTop: number;
}

/**
 * What the swap's layout effect does to the scroller: `'bottom'` pins it to
 * the bottom, a number is added to `scrollTop` (0: nothing to do).
 *
 * - Anchoring on: 0, the browser already held the place.
 * - At the bottom: pin, whatever the change.
 * - Region wholly above the viewport: the whole change.
 * - Region straddling the viewport's top: the same share of the change as the
 *   share of the region that was above the top, so the line at the top stays
 *   about where it was inside the region.
 * - Region starting at or below the top: 0, nothing above the reader moved.
 */
export function scrollCorrection(
  region: PendingRegion,
  newHeight: number,
  { atBottom, anchoring }: { atBottom: boolean; anchoring: boolean },
): number | 'bottom' {
  if (anchoring) return 0;
  if (atBottom) return 'bottom';
  const change = newHeight - region.height;
  if (change === 0 || region.top >= region.scrollTop) return 0;
  if (region.top + region.height <= region.scrollTop) return change;
  return (change * (region.scrollTop - region.top)) / region.height;
}
