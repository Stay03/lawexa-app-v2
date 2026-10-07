import { useEffect, useState } from 'react';
import { isRouteSkeletonShown } from './route-skeleton-state';

/**
 * The conversation screen waits this long before drawing its skeleton.
 *
 * WHY. After the page reloads (or the phone discards the tab), a conversation
 * the reader has opened before comes back from the copy on the device
 * (IndexedDB), and that read is quick: measured on live on 7 October 2026, the
 * messages painted 40 to 100 ms after the skeleton appeared, about 300 ms before
 * the server answered. The skeleton was a flash over content that was about to
 * arrive. Holding it for 200 ms lets the device copy paint first; when there is
 * no copy (a first open) the skeleton shows 200 ms later than before, and the
 * screen is blank, not broken, in that time.
 */
export const SKELETON_HOLD_MS = 200;

/** Starts the hold; `done` runs once it has lasted `ms`. Returns the cancel. */
export function scheduleHold(ms: number, done: () => void): () => void {
  const timer = setTimeout(done, ms);
  return () => clearTimeout(timer);
}

/**
 * Whether the skeleton shows: only while the screen is waiting AND the hold
 * for this conversation has run out. Keyed by conversation, so moving to
 * another conversation starts a new hold instead of inheriting the old one.
 */
export function skeletonVisible(waiting: boolean, heldFor: string | null, scope: string): boolean {
  return waiting && heldFor === scope;
}

/**
 * `waiting` held back by `holdMs`: true only once the screen has been waiting
 * that long for this `scope`. The state is set from the timer, never during
 * render or in the effect's body.
 *
 * No hold when the route skeleton is on screen as this screen mounts: the
 * screen's skeleton then shows at once, so the two identical skeletons hand
 * over with no gap (route-skeleton-state.ts).
 */
export function useSkeletonHold(waiting: boolean, scope: string, holdMs: number = SKELETON_HOLD_MS): boolean {
  const [heldFor, setHeldFor] = useState<string | null>(() => (isRouteSkeletonShown() ? scope : null));
  useEffect(() => {
    if (!waiting) return;
    return scheduleHold(holdMs, () => setHeldFor(scope));
  }, [waiting, scope, holdMs]);
  return skeletonVisible(waiting, heldFor, scope);
}
