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
 * That skeleton still appears: the route is still dynamic, so a soft navigation
 * still costs one Next round trip. It is now a round trip that does NO I/O,
 * which shortens the wait rather than removing the boundary.
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
export default function V2HomePage() {
  return <V2Home />;
}
