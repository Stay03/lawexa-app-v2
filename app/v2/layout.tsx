import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { HydrationBoundary } from '@tanstack/react-query';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { V2QueryProvider } from '@/v2/runtime/query-provider';
import { prefetchRecentsState } from '@/v2/features/conversations/server';
import { AppShell } from '@/v2/shell/AppShell';
import { DockProvider, DockHost } from '@/v2/shell/Dock';
import { V2Sidebar } from '@/v2/shell/V2Sidebar';
import { V2Drawer } from '@/v2/shell/V2Drawer';
import { V2Header } from '@/v2/shell/V2Header';
import { KeyboardInsetSync } from '@/v2/shell/use-keyboard-inset';
import { DocumentLock } from '@/v2/shell/document-lock';
import { verifySession } from '@/v2/runtime/session';
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
    { media: '(prefers-color-scheme: light)', color: '#C9A227' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

/**
 * Server shell for the hidden v2 tree. Inherits the root theme + toaster from
 * `app/layout.tsx`, but mounts its OWN `V2QueryProvider` — the v2 QueryClient
 * (v2 tiers + global MutationCache) nests inside and shadows the root v1
 * `QueryProvider` for everything below, so v2 runs the v2 data policy while v1
 * pages keep the root client untouched.
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

  // Server-verified identity for the shell chrome (footer avatar/name/plan gate,
  // notification bell visibility). React-cached, so this shares the one
  // `/auth/me` round trip with the page's own `verifySession()` call.
  const session = await verifySession();
  const user = session?.user ?? null;

  // Server-prefetch the sidebar/drawer recents (first page) so a signed-in hard load
  // paints real conversation rows at first paint, no skeleton flash (wave-4). Awaited
  // deliberately (real rows require a resolved query) and gated on `user` — guests /
  // failures get `undefined` (a no-op HydrationBoundary) and the client fetches as
  // before. Same query key the chrome reads, so the client `useInfiniteQuery` adopts
  // the hydrated page seamlessly. See `features/conversations/server.ts`.
  const recentsState = await prefetchRecentsState(user);

  return (
    <div className="bg-background text-foreground">
      {/* Mirrors the v1 localStorage token into the httpOnly session cookie the
          server DAL reads. Renders nothing; pure network side-effect. */}
      <SessionSync />
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
      <V2QueryProvider>
        {/* Seed the browser query cache with the server-prefetched recents (the
            sidebar/drawer read the same key), so signed-in first paint is real rows
            rather than a skeleton. Inside the provider so it hydrates into the client
            the chrome consumes; `undefined` state (guests / prefetch miss) is a no-op. */}
        <HydrationBoundary state={recentsState}>
          {/* DockProvider bridges a route's floating composer into the AppShell
              dock grid-row (grid-row 3, outside the scroll container) via a portal
              — see v2/shell/Dock.tsx. Wraps the whole shell so both the dock host
              (in the dock slot) and the page (in content) share one provider. When
              no route portals anything, the dock stays empty and its row collapses. */}
          <DockProvider>
            <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
              <V2Sidebar user={user} />
              <SidebarInset className="min-h-0 overflow-hidden">
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
      </V2QueryProvider>
    </div>
  );
}
