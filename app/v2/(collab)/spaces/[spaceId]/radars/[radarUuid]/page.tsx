import type { Metadata } from 'next';
import { SpaceRadarScreen } from '@/v2/features/spaces/detail/radars/SpaceRadarScreen';

/**
 * v2 `/spaces/[spaceId]/radars/[radarUuid]` — a space's Radar (Radar in
 * Spaces, first part, 26 October 2026). Membership-gated, so `noindex` and no
 * server fetch; the Radar's name reaches the tab through the client's header
 * context, as on the personal Radar page.
 */
export const metadata: Metadata = {
  title: 'Radar',
  robots: { index: false, follow: false },
};

export default async function V2SpaceRadarPage({
  params,
}: {
  params: Promise<{ spaceId: string; radarUuid: string }>;
}) {
  const { spaceId, radarUuid } = await params;
  return <SpaceRadarScreen key={`${spaceId}:${radarUuid}`} spaceUuid={spaceId} radarUuid={radarUuid} />;
}
