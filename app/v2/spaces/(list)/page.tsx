import type { Metadata } from 'next';
import { SpacesScreen } from '@/v2/features/spaces/list/SpacesScreen';

/**
 * v2 `/spaces` — the server shell for the spaces list (phase-5 W4 item 1).
 *
 * IT LIVES IN A `(list)` ROUTE GROUP so its `loading.tsx` wraps ONLY this
 * route. Without the group, a `loading.tsx` beside the segment would also
 * cover `/spaces/[spaceId]`, and every hop into a space would flash the LIST's
 * silhouette before the space's own one — the quiz `(hub)` precedent, same
 * reason.
 *
 * PRIVATE SURFACE CONVENTIONS: `robots: noindex, nofollow` (a members-only
 * workroom must never be crawled), no canonical and no OG card — both would
 * advertise a page that resolves to a sign-in wall.
 *
 * NO SERVER PREFETCH, deliberately. The cases and statutes lists prefetch
 * because they are public and indexed; nothing here is crawlable and every row
 * is per-account and per-membership. The client cache owns the rows — and it
 * is already WARM, because the realtime spine mounts the same spaces list key
 * for its badge rollups, so an arrival usually paints rows in the first frame
 * and re-checks behind them (`REFETCH_ON_VISIT`).
 *
 * LIVE SINCE W5 (manifest entry `/spaces/*`) — the nav's Spaces row now opens
 * this screen for every registered account (owner decision D1).
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Spaces',
    description:
      'Your shared workrooms — channels, task lists, files and Lawexa on call.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * the same safety argument as `app/v2/bookmarks/page.tsx`. The route is
 * dynamic (the v2 layout reads the session cookie) and Next's default
 * `staleTimes.dynamic` is 0, so without this every arrival re-fetches the
 * segment and `loading.tsx` covers the wait, hiding cached rows behind a
 * full-page skeleton. This segment awaits nothing and renders one client
 * component, so a re-used payload cannot show old data — it can only skip a
 * round trip that produced nothing.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2SpacesPage() {
  return <SpacesScreen />;
}
