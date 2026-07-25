import type { Metadata } from 'next';
import { ConversationsScreen } from '@/v2/features/conversations/list/ConversationsScreen';

/**
 * v2 `/conversations` — server shell. Follows the v2 metadata convention
 * (app/v2/layout.tsx docblock): a server `page.tsx` exporting `generateMetadata`
 * that renders a `'use client'` child (client modules cannot export metadata).
 *
 * This is a PRIVATE, authenticated list of the user's own conversations — unlike
 * the public `/c/[id]` share pages, there is nothing here for a crawler to index,
 * so metadata is deliberately minimal and honest: a bare `title` ("Conversations"
 * → the root "%s | Lawexa" template appends the brand) + a description, and
 * `robots: { index: false, follow: false }` so a private surface never invites
 * indexing. No canonical / OG share card is emitted (that would advertise a page
 * that resolves to a sign-in wall).
 *
 * This segment awaits NOTHING. It used to open with `await verifySession()` just
 * to compute the `signedIn` flag, which cost an uncached `/auth/me` round trip on
 * every navigation here (React `cache()` dedupes only within one server render,
 * and a soft navigation re-renders this page without re-rendering the layout) —
 * so `loading.tsx` covered a wait on Laravel every time. That shortened the wait
 * but did not remove the boundary; `unstable_dynamicStaleTime` below does, by
 * letting a return trip skip the round trip entirely.
 * The screen now reads the same server-verified flag from `<V2SessionProvider>`,
 * which the layout published from its own single `/auth/me` call. Guests are
 * unchanged: `signedIn` is still `!!session`, so a stale or revoked token still
 * resolves to the signed-out state, never a perpetually-gated skeleton.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Conversations',
    description: 'Browse and search your Lawexa AI conversations.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES (owner: "shouldn't it
 * cache and show what it got the last time?").
 *
 * It should, and the data layer already did — `conversationsQueries.infiniteList`
 * retains its rows for 30 minutes and `useNewRows` announces anything that arrives
 * above the reader. None of that was VISIBLE, because none of it had run yet: the
 * route is dynamic (the v2 layout reads the session cookie) and Next's default
 * `staleTimes.dynamic` is 0, so EVERY navigation here re-fetched this segment from
 * the server and `loading.tsx` covered the wait. The cached rows only painted after
 * that round trip, on the far side of a full-page skeleton.
 *
 * This is the per-PAGE lever rather than `experimental.staleTimes` in
 * `next.config.ts` on purpose. The global switch would change the router cache for
 * every v1 route too, and v1 is not ours to re-time in a v2 fix round. Declared
 * here, the change reaches exactly the three v2 pages that carry it and nothing
 * else. (Next forbids the export in layouts, which is the same boundary drawn from
 * the other side.)
 *
 * NOTHING SERVER-RENDERED CAN GO STALE HERE. This segment renders one client
 * component and awaits nothing; every value on screen comes from the browser query
 * cache or from `<V2SessionProvider>`, which the LAYOUT publishes. So a re-used
 * payload cannot show old data — it can only skip a round trip that produced
 * nothing.
 *
 * IDENTITY IS STILL EXACT. Re-entering v2 from a v1 route can serve a cached LAYOUT
 * segment, and that one does carry identity. `SessionSync` compares the published
 * snapshot against the token the browser holds and calls `router.refresh()` on any
 * disagreement; a refresh runs `invalidateBfCache()`, which version-bumps every
 * cached segment and forces a fresh render. `V2CacheIdentityGuard` then clears the
 * query cache on the same edge. Sign-in, sign-out and account switches all converge
 * — verified in Next 16.2.10's `segment-cache/bfcache.js`.
 *
 * 5 minutes covers a real detour (read a conversation, come back) and is bounded so
 * a tab left open all day cannot pin an arbitrarily old tree. A first visit still
 * shows `loading.tsx`, which is what a route boundary is for.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2ConversationsPage() {
  return <ConversationsScreen />;
}
