import { V2Home } from './home';

/**
 * v2 home (server shell). Renders the `'use client'` home surface and awaits
 * NOTHING — this segment does no I/O at all.
 *
 * WHY IT NO LONGER CALLS `verifySession()`. It used to, purely to obtain three
 * small values (`firstName`, `signedIn`, `role`), and that single `await` cost a
 * full uncached `/auth/me` round trip on EVERY navigation here: React `cache()`
 * dedupes only within one server render, and a soft navigation re-renders this
 * page segment without re-rendering the layout above it. Because the route is
 * dynamic, Next prefetches it only down to `loading.tsx` and holds dynamic
 * segments in the Router Cache for 0s — so every navigation waited on Laravel
 * behind the route skeleton.
 *
 * Removing the I/O shortened that wait but did not remove the boundary — the route
 * is still dynamic, so a soft navigation still cost one Next round trip and still
 * showed `loading.tsx`. `unstable_dynamicStaleTime` below is what finally removes
 * it: a return inside the window is served from the client router cache, so no
 * round trip happens and no boundary is reached.
 *
 * The layout already verified the session for the shell chrome and publishes it
 * through `<V2SessionProvider>`; the layout is preserved across soft navigations,
 * so `V2Home` reads the same server-verified values from context, resolved, on
 * its first render. Nothing arrives late, so no module mounts a beat behind and
 * nothing reflows. See v2/runtime/session-context.tsx.
 *
 * The `V2-HOME` curl marker lives on the client home's root (`data-v2-marker`),
 * which server-renders into the initial HTML.
 */
/**
 * KEEP THE HOME IN THE CLIENT ROUTER CACHE FOR 5 MINUTES. Same lever, same
 * reasoning, and the same safety argument as `app/v2/conversations/page.tsx` —
 * which carries the full note, including why this is a per-page export rather than
 * `experimental.staleTimes` in `next.config.ts`, and why a re-used payload cannot
 * strand a signed-in user on the guest home.
 *
 * It matters most here. The home is the surface the user leaves and returns to
 * between everything else, and its modules (recents, bookmarks, spaces, radars,
 * recently viewed, quiz) are all retained for 30 minutes. Without this, every
 * return re-fetched a segment that does no I/O and covered the warm modules with
 * `loading.tsx` while it did.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2HomePage() {
  return <V2Home />;
}
