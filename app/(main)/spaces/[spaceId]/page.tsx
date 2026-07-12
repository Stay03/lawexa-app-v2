'use client';

import { use } from 'react';

import { SpaceDetailView } from '@/components/collab/SpaceDetailView';

interface SpacePageProps {
  params: Promise<{ spaceId: string }>;
}

export default function SpacePage({ params }: SpacePageProps) {
  const { spaceId } = use(params);
  return <SpaceDetailView spaceUuid={spaceId} />;
}
