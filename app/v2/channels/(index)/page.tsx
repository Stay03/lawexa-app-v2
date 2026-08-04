import type { Metadata } from 'next';
import { MyChannelsScreen } from '@/v2/features/channels/my-channels/MyChannelsScreen';

/**
 * v2 `/channels` — the "My channels" index (owner decision D6). In v1 this URL
 * 404'd: the cross-space `GET /api/channels` existed and already fed the
 * home's "Jump back in" strip, but nothing rendered the whole list. This is
 * that list, and it is the natural mobile entry point into the conversations.
 *
 * PRIVATE SURFACE CONVENTIONS: `noindex`, no canonical, no OG card, NO server
 * prefetch. The rows are per-membership and realtime-fed; the client cache is
 * the right first paint — and it is already warm, because the realtime spine
 * mounts this exact query key for its badge rollups.
 *
 * SEGMENT LAYOUT: the `/channels` collab gate already lives in
 * `app/v2/channels/layout.tsx` (W1), so this page needs none of its own.
 *
 * IT LIVES IN AN `(index)` ROUTE GROUP so its `loading.tsx` wraps ONLY this
 * route. A `loading.tsx` placed directly in `app/v2/channels/` would also be
 * the outer boundary for `/channels/[channelId]`, and a hard load of a channel
 * would then paint the LIST's silhouette before the channel's own one — the
 * quiz `(hub)` precedent, and exactly what the phase plan asks for
 * ("route-group `loading.tsx` shaped like the channel").
 *
 * LIVE SINCE W5 (manifest entry `/channels/*`). The URL that 404'd in v1 is
 * now a real screen for opted-in readers.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'My channels',
    description: 'Every channel you belong to, newest activity first.',
    robots: { index: false, follow: false },
  };
}

/** Same client-router-cache lever as the other private v2 list surfaces — the
 *  segment awaits nothing, so a re-used payload can only skip a round trip
 *  that produced nothing, which is what keeps the cached rows on screen
 *  instead of `loading.tsx`. */
export const unstable_dynamicStaleTime = 300;

export default function V2ChannelsIndexPage() {
  return <MyChannelsScreen />;
}
