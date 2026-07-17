import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { V2QueryProvider } from '@/v2/runtime/query-provider';
import { SessionSync } from './session-sync';

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Mirrors the v1 localStorage token into the httpOnly session cookie the
          server DAL reads. Renders nothing; pure network side-effect. */}
      <SessionSync />
      <V2QueryProvider>{children}</V2QueryProvider>
    </div>
  );
}
