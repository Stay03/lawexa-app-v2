/**
 * Whether a conversation skeleton is on screen: the route's own
 * (`app/v2/c/[conversationId]/loading.tsx`) or the move-first layer's frame
 * (`v2/shell/move-first.tsx`). The route skeleton and the screen's skeleton are
 * the same picture, so when the route skeleton is showing, the screen must take
 * over with its skeleton AT ONCE: holding it (skeleton-hold.ts) there would put
 * a blank gap between two identical skeletons. The hold is only for a screen
 * that mounts with no skeleton before it.
 *
 * A counter, not a flag, so two mounted boundaries cannot clear each other.
 * The screen reads it in its first render, while the route skeleton is still
 * mounted (React renders the page before it removes the fallback). Plain
 * TypeScript, so tests can import it; `RouteSkeletonMark` sets it.
 */
let mounted = 0;

export function isRouteSkeletonShown(): boolean {
  return mounted > 0;
}

/** Counts one mounted route skeleton; returns the matching release. */
export function markRouteSkeleton(): () => void {
  mounted += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    mounted -= 1;
  };
}
