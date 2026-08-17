import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HydrationBoundary } from '@tanstack/react-query';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { V2QueryProvider } from '@/v2/runtime/query-provider';
import { V2CacheIdentityGuard } from '@/v2/runtime/cache-identity-guard';
import { ChannelDeviceSweep } from '@/v2/features/channels/device-sweep';
import { prefetchRecentsState } from '@/v2/features/conversations/server';
import { AppShell } from '@/v2/shell/AppShell';
import { DockProvider, DockHost } from '@/v2/shell/Dock';
import { V2Sidebar } from '@/v2/shell/V2Sidebar';
import { V2Drawer } from '@/v2/shell/V2Drawer';
import { V2Header } from '@/v2/shell/V2Header';
import { KeyboardInsetSync } from '@/v2/shell/use-keyboard-inset';
import { DocumentLock } from '@/v2/shell/document-lock';
import { SystemBarColour } from '@/v2/shell/SystemBarColour';
import { TouchPress } from '@/v2/shell/touch-press';
import { RouteTrail } from '@/v2/shell/route-trail';
import { RouteMotion } from '@/v2/shell/route-motion';
import { ScrollMemory } from '@/v2/shell/scroll-memory';
import { verifySession } from '@/v2/runtime/session';
import { V2SessionProvider } from '@/v2/runtime/session-context';
import { V2PushLifecycle } from '@/v2/runtime/push/lifecycle';
import { RealtimeSpine } from '@/v2/runtime/realtime/spine';
import { SessionSync } from './session-sync';
import '@/v2/shell/shell.css';

/**
 * v2 metadata convention (exemplar for every phase-3+ feature route):
 *
 *  - `metadataBase` is NOT set here — the root layout (`app/layout.tsx`) owns it
 *    and it flows down to the whole v2 tree.
 *  - `title.template` ('%s | Lawexa') is inherited from root too, so v2 routes
 *    export a BARE `title` and the brand suffix is appended automatically
 *    (use `title.absolute` only to opt a route out).
 *  - EVERY public v2 route ships a `generateMetadata` returning a real title,
 *    description, canonical URL, and `openGraph`. The required shape is a server
 *    `page.tsx` that exports `generateMetadata` and renders a `'use client'`
 *    child: client modules cannot export metadata, so the server shell is
 *    mandatory (mirrors the v1 `/c/[id]` reference implementation).
 *  - OG images fall back to the site-wide `app/opengraph-image.tsx`; a route
 *    with its own share card sets `openGraph.images`, which overrides the
 *    default.
 */
export const metadata: Metadata = {
  // `absolute` — "Lawexa v2 preview" already names the brand; the "%s | Lawexa"
  // template would double-brand it.
  title: { absolute: 'Lawexa v2 preview' },
  description:
    'Preview of the next-generation Lawexa experience — Nigerian legal research, cases, statutes, and notes.',
};

/**
 * v2 viewport — the mobile shell contract (foundation-standards.md §4).
 *
 * Next merges viewport exports root → leaf, deepest wins per field, so this
 * OVERRIDES the root layout's viewport for every /v2/* route (verified: /v2's
 * <head> carries `viewport-fit=cover` + `interactive-widget=resizes-content`
 * and both theme-color metas; v1 routes keep the root's single `#C9A227`).
 *
 *  - `viewportFit: 'cover'`   — content extends under the notch/home-indicator;
 *    bars pad themselves back out via the `.v2-safe-*` utilities.
 *  - `interactiveWidget: 'resizes-content'` — Android/Firefox resize the layout
 *    viewport on keyboard open, so the `100dvh` shell tracks the keyboard with
 *    zero JS (iOS falls back to use-keyboard-inset.ts).
 *  - dual `themeColor` — v1's brand gold in light, the neutral dark surface
 *    (`--background` = oklch(0.145 0 0) ≈ #0a0a0a) in dark, so the browser UI
 *    chrome matches the active theme.
 */
export const viewport: Viewport = {
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    /* WHITE, not the brand gold. The page is white; gold drew a stripe across
       the top of it, which is the band the owner photographed on 17 August
       2026 beside a native app that has none. */
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

/**
 * Server shell for the hidden v2 tree. Inherits the root theme + toaster from
 * `app/layout.tsx`, but mounts its OWN `V2QueryProvider` — the v2 QueryClient
 * (v2 tiers + global MutationCache) nests inside and shadows the root v1
 * `QueryProvider` for everything below, so v2 runs the v2 data policy while v1
 * pages keep the root client untouched. It also mounts `V2SessionProvider` — the
 * ONE place the v2 tree fetches identity, published to every page below (see
 * `v2/runtime/session-context.tsx` for why the pages must not fetch it
 * themselves).
 *
 * Chrome composition (phase 2→3): `SidebarProvider` owns the sidebar/drawer open
 * state. `V2Sidebar` is the desktop rail (CSS-hidden on mobile, unmounted after
 * hydration there). `SidebarInset` holds the `AppShell` grid, whose header slot
 * is `V2Header` and whose content is the route. `V2Drawer` is the mobile drawer,
 * the sole consumer of `openMobile`. The AppShell `dock` slot is left empty —
 * the floating conversation composer arrives with the phase-3 conversation
 * screen. The provider wrapper is pinned to the dynamic viewport so the shell's
 * own `100dvh` grid owns all scrolling and the document never scrolls.
 */
export default async function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The env kill switch only disables the proxy rewrite; without this guard the
  // /v2 tree would still be directly reachable by URL. Killed switch ⇒ 404,
  // so "rollback" truly means nothing v2 is visible.
  if (process.env.V2_ENABLED !== 'true') {
    notFound();
  }

  // THE LAYOUT IS THE ONE PLACE THE SESSION IS FETCHED (see session-context.tsx).
  // A layout does not re-render on a soft navigation — Next reuses the cached layout
  // segment and requests only the changed page segment — so this `/auth/me` round trip
  // is paid once per FULL page load and is then free for the rest of the visit. That is
  // why the pages below no longer call `verifySession()` themselves: doing so cost an
  // uncached round trip (and therefore the route skeleton) on EVERY navigation.
  //
  // CONCURRENT, not serial. These two were previously awaited one after the other, so
  // the shell's TTFB was `/auth/me` PLUS `/conversations`. `prefetchRecentsState()` now
  // gates itself on cookie PRESENCE (a zero-network read) instead of taking the verified
  // user, so both requests are in flight at once and TTFB is the slower of the two.
  const [session, recentsState] = await Promise.all([
    verifySession(),
    prefetchRecentsState(),
  ]);

  // Server-verified identity for the shell chrome (footer avatar/name/plan gate,
  // notification bell visibility).
  const user = session?.user ?? null;

  return (
    <div className="bg-background text-foreground">
      {/* Mirrors the v1 localStorage token into the httpOnly session cookie the
          server DAL reads. Renders nothing; pure network side-effect.

          It is handed the session THIS render published so it can tell whether
          that snapshot is still true. It writes the cookie client-side, AFTER
          this layout already read it — so on a first v2 visit or a fresh sign-in
          the layout resolved a guest from a cookie that did not exist yet. Since
          the layout no longer re-renders per navigation, nothing would ever
          correct that; SessionSync therefore calls `router.refresh()` when — and
          only when — its sync actually changed the identity the server can see.
          The no-loop argument lives in that module's docblock. */}
      <SessionSync serverSignedIn={!!session} serverUserId={user?.id ?? null} />
      {/* Keyboard-inset sync — writes `--keyboard-inset` for the shell height
          (foundation-standards.md §4). Renders null. Self-calibrating: ≈0 on
          browsers that resize the layout viewport; the real keyboard height on
          overlay browsers (iOS Safari, and the Android browsers that ignore
          `interactive-widget` — the Galaxy-A21 class bug). */}
      <KeyboardInsetSync />
      {/* Adds `.v2-document-lock` to <html> while v2 is mounted (and removes it
          on soft-nav away) — the document-scroll lock must follow the shell's
          lifecycle because React never unloads the stylesheet. */}
      <DocumentLock />
      {/* Keeps the phone's status bar the colour of the page under it, and in
          step with OUR theme switch rather than the phone's. The static
          `themeColor` below answers the first paint; this corrects it. */}
      <SystemBarColour />
      {/* Marks the closest tappable ancestor of a finger with `data-pressed`,
          which is the only thing that makes 633 of the app's 729 tappable sites
          answer a touch at all (see the module for the count and the platform
          numbers). One passive listener; renders null. */}
      <TouchPress />
      {/* Remembers where this tab has been, so a back control can go BACK when
          the parent really is behind you instead of pushing a duplicate entry.
          Only does anything on browsers with no Navigation API; where there is
          one, the browser already knows exactly. Renders null. */}
      <Suspense fallback={null}>
        <RouteTrail />
      </Suspense>
      {/* Route changes MOVE rather than cut: a short directional entrance on the
          shell's content region at every pathname change: in from the right
          going forward, in from the left coming back. Renders null; it writes
          one attribute and never touches history, clicks or scrollTop. All of
          it lives inside `@media (prefers-reduced-motion: no-preference)`, so
          a reader who asked for less motion gets the old instant change. */}
      <RouteMotion />
      {/* Back/Forward + reload scroll restoration for the shell's ONE scroll
          container — the div is invisible to both native restoration and the
          router, so it restores itself. Push scroll stays Next's (see the
          ownership contract in the module). Renders null; the Suspense is the
          `useSearchParams` requirement (its settle effect re-stamps entries
          after loud filter writes), never a visual boundary. */}
      <Suspense fallback={null}>
        <ScrollMemory />
      </Suspense>
      <V2QueryProvider>
        {/* PRIVACY BOUNDARY — drops the whole v2 cache whenever the verified viewer
            changes. The v2 QueryClient is a module singleton and v1's sign-out clears
            only the v1 client, while v1's logout AND login are soft navigations — so
            without this, one user's cached lists, bookmarks, spaces, radars,
            recently-viewed and quiz scores would paint for the NEXT user on the same
            device for up to the 30-minute retention. See the file for the full trace. */}
        <V2CacheIdentityGuard userId={user?.id ?? null} />
        {/* THE SAME BOUNDARY, FOR THE DEVICE. The cache guard above owns what is
            in memory in the query client; this owns what the channels feature
            left on `localStorage` — the previous reader's half-written messages
            and their unsent ones. Renders null. It sits HERE, not in the
            composer it used to hang off, because that component only mounts for
            someone who can post: B reading a channel they may not write in, or
            never opening a channel at all, kept A's words on the disk for the
            whole session. See the module for the render/effect split. */}
        <ChannelDeviceSweep userId={user?.id ?? null} />
        {/* Publishes the ALREADY-COMPUTED session to the v2 client tree, so pages and
            screens read the server-verified identity from context instead of each
            awaiting `/auth/me` themselves. Because this layout is preserved across soft
            navigations, the value is resolved and free on every subsequent nav — the
            home's greeting name, role gating, and the `/c/{id}` ownership id are all
            correct on the FIRST render of every route, with no late-arriving props and
            therefore no reflow. See v2/runtime/session-context.tsx. */}
        <V2SessionProvider
          signedIn={!!session}
          userId={user?.id ?? null}
          name={user?.name ?? null}
          // The account card on `/settings` names the ACCOUNT, not the person,
          // and shows the face beside it. Both are already on the DTO this
          // layout resolved; publishing them here keeps the settings screen from
          // paying its own `/auth/me` round trip to say who is signed in.
          email={user?.email ?? null}
          avatarUrl={user?.avatar_url ?? null}
          username={user?.username ?? null}
          role={user?.role ?? null}
          // Verification state travels with identity because the quiz surfaces
          // need it to render a designed "verify your email" panel rather than
          // an error screen — every `/quizzes/*` endpoint 403s for an
          // unverified registered account. Signed out ⇒ `false` / `null`.
          isVerified={user?.is_verified ?? false}
          authProvider={user?.auth_provider ?? null}
        >
          {/* THE NOTIFICATION SPINE (phase-5 W1) — v2's one app-wide realtime
              mount: the users.{uuid} socket, the `.channel.unread` writers, the
              toast/sound dispatcher, and the title/favicon/OS-badge rollups.
              Renders null. It sits here — not in the collab segment layouts —
              because notifications are app-wide by contract (a mention must
              badge the title while the user reads a case), and it needs both
              the query client above and this session provider. Its socket
              lifecycle keys on the viewer, tearing down on the same identity
              edge V2CacheIdentityGuard clears the cache on. */}
          <RealtimeSpine />
          {/* CLOSED-APP PUSH, the other half of the same contract (phase-5
              W5). Renders null. It owns only the DEVICE TOKEN lifecycle —
              the idempotent boot re-sync and the teardown on the viewer
              edge — and never prompts: the one permission request lives in
              the in-channel nudge, on a user gesture. Foreground FCM
              messages are ignored entirely (digest §F.16); while a tab is
              visible the spine above is the delivery path. */}
          <V2PushLifecycle />
          {/* Seed the browser query cache with the server-prefetched recents — BOTH the
              sidebar/drawer infinite list and the home's single-page peek, which are
              different query keys — so signed-in first paint is real rows rather than a
              skeleton and the home never re-fetches a subset the server already has.
              Inside the provider so it hydrates into the client the chrome consumes;
              `undefined` state (guests / prefetch miss) is a no-op. */}
          <HydrationBoundary state={recentsState}>
            {/* DockProvider bridges a route's floating composer into the AppShell
                dock grid-row (grid-row 3, outside the scroll container) via a portal
                — see v2/shell/Dock.tsx. Wraps the whole shell so both the dock host
                (in the dock slot) and the page (in content) share one provider. When
                no route portals anything, the dock stays empty and its row collapses. */}
            <DockProvider>
              <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
                <V2Sidebar user={user} />
                {/* ── `clip`, NOT `hidden`, AND THE DIFFERENCE IS THE BUG ────
                    `overflow: hidden` makes a box unscrollable BY THE READER
                    and leaves it a scroll container: it still has scrollable
                    overflow, and the browser may still scroll it to reveal a
                    focused descendant. `overflow: clip` does not create a
                    scroll container at all, so there is nothing to scroll.

                    This box never scrolls by design — the shell inside it owns
                    scrolling — so it was `hidden`, and that was enough until
                    something inside it took focus. The owner photographed the
                    result on Android, 17 August 2026: tap an account-type row,
                    and the whole app sits shifted up by a few hundred pixels
                    with its header off the top of the screen and a black band
                    at the bottom. Nothing puts it back, because the reader
                    cannot scroll a box that is `hidden` either. Only a reload
                    clears it.

                    Measured both ways on the real build, tapping the same row:
                      hidden → shell top -28px, band 28px, main.scrollTop 28
                      clip   → shell top 0,    band 0,    main.scrollTop 0

                    NOTE the box still reports 129px of scrollable overflow in
                    both cases; `clip` does not remove the overflow, it removes
                    the ABILITY TO SCROLL IT, which is the part that hurt. What
                    creates those 129px is not known — no descendant accounts
                    for it, verified by hiding every one of them in turn — and
                    it is worth finding, but it is not what displaced the app.

                    `use-keyboard-inset.ts` already carries the same lesson for
                    the document and iOS. This is that lesson again, one box in,
                    on a platform with no keyboard involved. */}
                <SidebarInset className="min-h-0 overflow-clip">
                  {/* Non-scrolling shell: header / scrollable content / dock. DockHost
                      owns the dock slot: it renders an SSR height reservation on
                      conversation routes (so the floating composer never causes CLS) and
                      is the portal target for the real composer. On every other route it
                      renders nothing and the dock row collapses to zero height — the
                      bottom safe-area rides on the dock CONTENT, not this row, so no
                      route gains a phantom notch strip. */}
                  <AppShell header={<V2Header user={user} />} dock={<DockHost />}>
                    {children}
                  </AppShell>
                </SidebarInset>
                <V2Drawer user={user} />
              </SidebarProvider>
            </DockProvider>
          </HydrationBoundary>
        </V2SessionProvider>
      </V2QueryProvider>
    </div>
  );
}
