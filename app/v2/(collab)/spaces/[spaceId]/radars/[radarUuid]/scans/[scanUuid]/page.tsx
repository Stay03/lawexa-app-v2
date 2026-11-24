import { sidePanelSsrValue } from '@/v2/features/conversations/conversation/side-panel/side-panel-value';
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
  searchParams,
}: {
  params: Promise<{ spaceId: string; radarUuid: string; scanUuid: string }>;
  /** `?side=`: a draft beside the report's chat. */
  searchParams: Promise<{ side?: string | string[] }>;
}) {
  const { spaceId, radarUuid, scanUuid } = await params;
  const { side } = await searchParams;
  return (
    <SpaceRadarReportScreen
      key={`${spaceId}:${radarUuid}:${scanUuid}`}
      spaceUuid={spaceId}
      radarUuid={radarUuid}
      scanUuid={scanUuid}
      initialSide={sidePanelSsrValue(side)}
    />
  );
}
