import type { Metadata } from 'next';
import { RadarsScreen } from '@/v2/features/radars/list/RadarsScreen';

/**
 * v2 `/radars` — server shell. Follows the v2 metadata convention
 * (app/v2/layout.tsx docblock): a server `page.tsx` exporting
 * `generateMetadata` that renders a `'use client'` child.
 *
 * This is a PRIVATE, authenticated list of the user's own radars — the
 * `/conversations` precedent, applied verbatim: a bare `title` (the root
 * "%s | Lawexa" template appends the brand), a description, and
 * `robots: noindex` so a private surface never invites indexing. No
 * canonical / OG card — that would advertise a page that resolves to a
 * sign-in wall.
 *
 * NO SERVER PREFETCH, deliberately. The cases page prefetches because it is
 * public and indexed — its rows must be in the first-paint HTML for crawlers.
 * Nothing here is crawlable, so this segment awaits nothing (the
 * conversations precedent): the client query cache owns the rows, paints them
 * instantly on return visits (30-min `gcTime`), and re-checks on every
 * arrival (`REFETCH_ON_VISIT`).
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Radar',
    description:
      'Your saved watches — scheduled AI scans over the legal developments you track.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — same lever and
 * same safety argument as `app/v2/conversations/page.tsx`, which carries the
 * full note. This segment awaits nothing, so a re-used payload cannot show
 * old data; it only skips a round trip that produced nothing.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2RadarsPage() {
  return <RadarsScreen />;
}
