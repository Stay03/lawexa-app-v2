/**
 * What a path change does to the shell scroller (Stay, 20 October 2026,
 * 19:52Z: a case opened from the list's second page opened mid-page). Every
 * page opened by a push starts at its top; Back and Forward keep the place
 * `scroll-memory.tsx` restores, and the first render is the hard load's own
 * restore. Pure, so it is tested with plain values.
 */
export function scrollOnPathChange(change: { firstRender: boolean; traversal: boolean }): 'keep' | 'top' {
  if (change.firstRender || change.traversal) return 'keep';
  return 'top';
}
