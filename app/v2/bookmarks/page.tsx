import type { Metadata } from 'next';
import { BookmarksScreen } from '@/v2/features/bookmarks/list/BookmarksScreen';

/**
 * v2 `/bookmarks` — server shell. Follows the v2 metadata convention
 * (app/v2/layout.tsx docblock): a server `page.tsx` exporting `generateMetadata`
 * that renders a `'use client'` child (client modules cannot export metadata).
 *
 * This is a PRIVATE, authenticated collection — the `/conversations` and
 * `/radars` precedent applied verbatim: a bare `title` (the root "%s | Lawexa"
 * template appends the brand), a description, and `robots: noindex, nofollow`
 * so a private surface never invites indexing. No canonical and no OG card —
 * both would advertise a page that resolves to a sign-in wall.
 *
 * NO SERVER PREFETCH, deliberately. The cases and statutes lists prefetch
 * because they are public and indexed: their rows must be in the first-paint
 * HTML for a crawler. Nothing here is crawlable and every row is per-account,
 * so this segment awaits NOTHING. The client query cache owns the rows, paints
 * them instantly on a return visit (30-minute `gcTime`) and re-checks on every
 * arrival (`REFETCH_ON_VISIT`) — which is what makes a star pressed on another
 * device show up here.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Bookmarks',
    description:
      'Your saved cases, statutes, notes and folders, newest first.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * the same safety argument as `app/v2/conversations/page.tsx`, which carries
 * the full note. The route is dynamic (the v2 layout reads the session cookie)
 * and Next's default `staleTimes.dynamic` is 0, so without this every arrival
 * re-fetches this segment from the server and `loading.tsx` covers the wait —
 * hiding the cached rows behind a full-page skeleton. This segment awaits
 * nothing and renders one client component, so a re-used payload cannot show
 * old data; it can only skip a round trip that produced nothing.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2BookmarksPage() {
  return <BookmarksScreen />;
}
