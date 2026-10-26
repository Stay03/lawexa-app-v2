import type { Metadata } from 'next';
import { SpaceRadarCreateScreen } from '@/v2/features/spaces/detail/radars/SpaceRadarCreateScreen';

/**
 * v2 `/spaces/[spaceId]/radars/new` — a Radar made in a space (Radar in
 * Spaces, first part, 26 October 2026). A private, membership-gated screen:
 * `noindex` and no server fetch, as the space page itself (see its file).
 */
export const metadata: Metadata = {
  title: 'New Radar',
  robots: { index: false, follow: false },
};

export default async function V2SpaceRadarNewPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  return <SpaceRadarCreateScreen key={spaceId} spaceUuid={spaceId} />;
}
