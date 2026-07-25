'use client';

import { useV2Session } from '@/v2/runtime/session-context';
import type { HomeTab } from '@/v2/shell/home-tabs';
import { ChatHome } from '@/v2/shell/designs/ChatHome';
import { WorkHome } from '@/v2/shell/designs/WorkHome';
import { StudyHome } from '@/v2/shell/designs/StudyHome';

/**
 * V2Home — the shared body of the three home ROUTES. Each route (`/`, `/work`,
 * `/study`) renders this with its own `tab`, so the surface on screen is decided by
 * the URL and therefore by the SERVER — see `v2/shell/home-tabs.ts` for why that
 * replaced a `localStorage` store, and what it fixed.
 *
 * NO CROSS-FADE HERE ANY MORE. The old wrapper faded the outgoing surface out and
 * the incoming one in, because it was the one element that survived a swap. A tab
 * change is now a NAVIGATION: the router owns the transition, each tab has its own
 * `loading.tsx` for a cold visit, and a warm one is served from the router cache.
 *
 * SESSION FROM CONTEXT, NOT PROPS. `name` / `signedIn` / `role` used to be
 * threaded down from `app/v2/page.tsx`, which meant the page had to `await
 * verifySession()` — an uncached `/auth/me` round trip on every navigation, and
 * therefore the route skeleton every time. They now come from
 * `<V2SessionProvider>` in the v2 layout, which holds the SAME server-verified
 * session; the layout survives soft navigations, so the values are already
 * resolved here and the page awaits nothing.
 *
 * NOTHING ARRIVES LATE — the shift guard. This matters beyond speed. The
 * surfaces below make first-render-only decisions with these values:
 * `HomeGreeting` resolves the greeting through a lazy `useState` initializer
 * (`getSmartGreetingParts(name)`), so a `name` that showed up after mount would
 * be ignored forever; and `role` gates WorkSpaces / JumpBackIn / Quiz, which sit
 * in independent grid cells on desktop but MID-SCROLL on mobile, where a late
 * mount would shove the content below them down. Because the session is resolved
 * before this component's first render on every path — SSR on a hard load,
 * already-in-memory context on a soft navigation — the role-gated modules are
 * present or absent from frame one. No reserved-height placeholder is needed (and
 * none would be honest: for a plain user those modules never render at all).
 *
 * SYMMETRIC SWAP (owner #24): the tab flip is not a hard cut. This wrapper is the
 * ONE persistent element that survives the swap (the surface roots key-remount,
 * so they can't own the transition themselves). The store raises `fading` for a
 * beat before it swaps the tab, so this wrapper fades the outgoing home OUT, the
 * tab flips at the low point, then it fades the incoming home IN — both
 * directions animate. `duration-200 ease-in-out` (owner #32) stays in lockstep
 * with the store's `FADE_MS` (200ms), which is when the tab swaps. `h-full` gives
 * the surface roots a definite height context for their own `min-h-full` while
 * the wrapper persists across the swap. Reduced motion skips the fade (store-side)
 * and the `motion-reduce` guard drops the transition here too.
 *
 * Every surface carries the `data-v2-marker="V2-HOME"` marker + its
 * `data-home-tab` on its root and is server-renderable; the store's server
 * snapshot is `'chat'`, so the initial HTML always contains the Chat home with
 * the marker present.
 */
export function V2Home({ tab }: { tab: HomeTab }) {
  const { name, signedIn, role, userId } = useV2Session();

  // v1 parity: the greeting engine takes the FIRST name only. A pure string
  // derivation of an already-resolved value — no clock, no randomness, nothing
  // the React Compiler objects to in a render body.
  const firstName = name?.trim().split(/\s+/)[0];
  // The surfaces model "signed out" as `undefined` role (their props are
  // optional); the session snapshot models it as `null`. Normalise once, here.
  const surfaceRole = role ?? undefined;

  return (
    <div className="h-full">
      {/* KEYED ON IDENTITY. The surfaces capture `name` in a first-render-only lazy
          initializer (`HomeGreeting`), so a surface mounted for one identity can never
          re-read it for another. That normally cannot happen — the session is resolved
          before first render — except across the ONE transition `SessionSync` can now
          produce: a first v2 visit or a fresh sign-in renders guest, then
          `router.refresh()` re-renders the layout with the real user. Without this key
          React would preserve the guest-mounted greeting and it would stay nameless for
          the visit. Keying the surface on the user id makes "this home belongs to this
          identity" structural. It is a no-op on every normal render (the id never
          changes), and on sign-out it correctly discards the previous user's surface
          state rather than carrying it into the guest view. */}
      {tab === 'work' ? (
        <WorkHome key={userId} name={firstName} signedIn={signedIn} role={surfaceRole} />
      ) : tab === 'study' ? (
        <StudyHome key={userId} name={firstName} signedIn={signedIn} role={surfaceRole} />
      ) : (
        <ChatHome key={userId} name={firstName} signedIn={signedIn} role={surfaceRole} />
      )}
    </div>
  );
}
