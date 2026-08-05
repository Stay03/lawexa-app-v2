import type { Metadata } from 'next';
import { SpaceScreen } from '@/v2/features/spaces/detail/SpaceScreen';

/**
 * v2 `/spaces/[spaceId]` — the thin server shell (phase-5 W4 item 2).
 *
 * PRIVATE SURFACE CONVENTIONS: `noindex` and no data fetch in
 * `generateMetadata`. A space's NAME is membership-gated, so resolving it here
 * would spend a server round trip to render a title that a non-member must not
 * see anyway; the live screen publishes the name into the shell header the
 * moment its query lands.
 *
 * NO SERVER PREFETCH: the space, its channels and its roster are all
 * viewer-scoped and membership-gated, and the channel rows are realtime-fed.
 * The client cache is the right first paint — arriving from `/spaces` the row
 * data is already warm.
 *
 * `key={spaceId}` remounts the screen wholesale per space, so its dialog state
 * can never leak from one space into another (the channel route's reasoning,
 * applied here). The SPACE ITSELF is held one level up, by the `(collab)`
 * layout's frame, which is what keeps the rail on screen while the reader moves
 * between this page and the channels below it.
 *
 * LIVE SINCE W5 (manifest entry `/spaces/*`); moved under the `(collab)` group
 * in the redesign wave, which changes the file path and NOT the URL.
 */
export const metadata: Metadata = {
  title: 'Space',
  robots: { index: false, follow: false },
};

export default async function V2SpacePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  return <SpaceScreen key={spaceId} spaceUuid={spaceId} />;
}
