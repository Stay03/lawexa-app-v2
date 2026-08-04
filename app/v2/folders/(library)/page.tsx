import type { Metadata } from 'next';

import { FoldersScreen } from '@/v2/features/folders/list/FoldersScreen';

/**
 * v2 `/folders` — server shell for the viewer's folder library.
 *
 * Follows the v2 metadata convention (app/v2/layout.tsx docblock): a server
 * `page.tsx` exporting `generateMetadata` that renders a `'use client'` child
 * (client modules cannot export metadata).
 *
 * ── WHY `noindex` ───────────────────────────────────────────────────────────
 * MEASURED against production on August 4 2026: every folder endpoint answers
 * 401 Unauthenticated without a bearer token, and `my-folders` is the viewer's
 * OWN shelf besides. A crawler carries no token, so an indexed `/folders` could
 * only ever resolve to a sign-in wall — the `/notes`, `/bookmarks` and
 * `/conversations` precedent is followed exactly: a bare title, a description,
 * no canonical and no OG card, because either would advertise a page that
 * resolves to a wall.
 *
 * NO SERVER PREFETCH, deliberately, for the same reason: the segment could only
 * prefetch with the READER's token, every row is per-account, and nothing here
 * is crawlable. The client query cache owns the rows, paints them instantly on
 * a return visit (30-minute `gcTime`) and re-checks on arrival.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Folders',
    description:
      'Your folders — the cases, statutes and notes for one matter, kept together.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * the same safety argument as `app/v2/notes/(library)/page.tsx`, which carries
 * the full note. The route is dynamic (the v2 layout reads the session cookie)
 * and Next's default `staleTimes.dynamic` is 0, so without this every arrival
 * re-fetches this segment from the server and `loading.tsx` covers the wait —
 * hiding rows the query cache already holds behind a full-page skeleton. This
 * segment awaits nothing and renders one client component, so a re-used payload
 * cannot show old data; it can only skip a round trip that produced nothing.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2FoldersPage() {
  return <FoldersScreen />;
}
