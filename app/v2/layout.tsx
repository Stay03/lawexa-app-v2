import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { V2QueryProvider } from '@/v2/runtime/query-provider';
import { AppShell } from '@/v2/shell/AppShell';
import { KeyboardInsetSync } from '@/v2/shell/use-keyboard-inset';
import { DocumentLock } from '@/v2/shell/document-lock';
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
 * Neutral phase-1 shell header — just the wordmark (Comfortaa is the brand face;
 * standards §3 reserves it for wordmarks). No nav yet: the mobile nav pattern is
 * an open phase-2 design question (bottom tab bar was rejected), so WP6 ships the
 * shell MECHANICS any nav can later slot into, not navigation UI. `bg-background`
 * / `border-b` keep it token-neutral until phase-2 restyles the header chrome.
 */
const shellHeader = (
  <div className="flex h-14 items-center border-b border-border bg-background px-4">
    <span className="font-comfortaa text-base font-semibold tracking-tight text-foreground">
      Lawexa
    </span>
  </div>
);

/**
 * Server shell for the hidden v2 tree. Inherits the root theme + toaster from
 * `app/layout.tsx`, but mounts its OWN `V2QueryProvider` — the v2 QueryClient
 * (v2 tiers + global MutationCache) nests inside and shadows the root v1
 * `QueryProvider` for everything below, so v2 runs the v2 data policy while v1
 * pages keep the root client untouched. Real chrome (nav, breadcrumbs) arrives
 * in later phases.
 */
export default function V2Layout({
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

  return (
    <div className="bg-background text-foreground">
      {/* Mirrors the v1 localStorage token into the httpOnly session cookie the
          server DAL reads. Renders nothing; pure network side-effect. */}
      <SessionSync />
      {/* iOS keyboard-inset sync — writes `--keyboard-inset` for the shell height
          (foundation-standards.md §4). Renders null; no-op off iOS Safari. */}
      <KeyboardInsetSync />
      {/* Adds `.v2-document-lock` to <html> while v2 is mounted (and removes it
          on soft-nav away) — the document-scroll lock must follow the shell's
          lifecycle because React never unloads the stylesheet. */}
      <DocumentLock />
      <V2QueryProvider>
        {/* Non-scrolling shell: header / scrollable content / dock (floating
            composer's home in phase 3). Mechanics only — see AppShell. */}
        <AppShell header={shellHeader}>{children}</AppShell>
      </V2QueryProvider>
    </div>
  );
}
