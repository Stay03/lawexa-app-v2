import type { Metadata } from 'next';
import { SpaceRadarReportScreen } from '@/v2/features/spaces/detail/radars/SpaceRadarReportScreen';

/**
 * v2 `/spaces/[spaceId]/radars/[radarUuid]/scans/[scanUuid]` — one report of
 * a space's Radar (Radar in Spaces, first part, 26 October 2026).
 * Membership-gated, so `noindex` and no server fetch; a report shared
 * publicly keeps its own `/radars/{radar}/scans/{scan}` address and card.
 */
export const metadata: Metadata = {
  title: 'Radar report',
  robots: { index: false, follow: false },
};

export default async function V2SpaceRadarReportPage({
  params,
}: {
  params: Promise<{ spaceId: string; radarUuid: string; scanUuid: string }>;
}) {
  const { spaceId, radarUuid, scanUuid } = await params;
  return (
    <SpaceRadarReportScreen
      key={`${spaceId}:${radarUuid}:${scanUuid}`}
      spaceUuid={spaceId}
      radarUuid={radarUuid}
      scanUuid={scanUuid}
    />
  );
}
