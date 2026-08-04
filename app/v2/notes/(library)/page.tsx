import type { Metadata } from 'next';

import { NotesScreen } from '@/v2/features/notes/library/NotesScreen';

/**
 * v2 `/notes` — server shell for the notes library.
 *
 * Follows the v2 metadata convention (app/v2/layout.tsx docblock): a server
 * `page.tsx` exporting `generateMetadata` that renders a `'use client'` child
 * (client modules cannot export metadata).
 *
 * ── WHY THIS IS `noindex` AND NOT THE CASES TREATMENT ───────────────────────
 * MEASURED against production on August 4 2026:
 *
 *     GET /api/notes            → 401 Unauthenticated  (no token)
 *     GET /api/notes/{slug}     → 401 Unauthenticated  (no token)
 *     GET /api/cases/{slug}     → 404 Resource not found (no token — public)
 *
 * So unlike the case and statute libraries, every notes read is behind a
 * bearer token. A crawler carries none, which means an indexed `/notes` would
 * resolve to a sign-in wall for the only visitor who matters to indexing.
 * `robots: noindex, nofollow` says that out loud rather than inviting a crawl
 * that can only disappoint, and the `/conversations` + `/bookmarks` precedent
 * (a bare title, a description, no canonical and no OG card) is followed
 * exactly: a canonical or a share card would advertise a page that resolves to
 * a wall.
 *
 * If the backend later opens notes reads to unauthenticated requests, this
 * page and `[slug]/page.tsx` become the cases treatment in one edit each —
 * recorded as a backend-ask candidate rather than pre-built on a promise.
 *
 * NO SERVER PREFETCH, deliberately, for the same reason: the segment could
 * only prefetch with the READER's token, every row is per-account
 * (`is_bookmarked`, and My notes is private outright), and nothing here is
 * crawlable. The client query cache owns the rows, paints them instantly on a
 * return visit (30-minute `gcTime`) and re-checks on arrival.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Notes',
    description:
      'Notes shared by the Lawexa community, and your own — case summaries, study notes, and everything worth keeping.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * the same safety argument as `app/v2/bookmarks/page.tsx`, which carries the
 * full note. The route is dynamic (the v2 layout reads the session cookie) and
 * Next's default `staleTimes.dynamic` is 0, so without this every arrival
 * re-fetches this segment from the server and `loading.tsx` covers the wait —
 * hiding rows the query cache already holds behind a full-page skeleton. This
 * segment awaits nothing and renders one client component, so a re-used
 * payload cannot show old data; it can only skip a round trip that produced
 * nothing.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2NotesPage() {
  return <NotesScreen />;
}
