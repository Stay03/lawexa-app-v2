'use client';

import { use } from 'react';

import { RadarInboxView } from '@/components/radar/RadarInboxView';

interface RadarPageProps {
  params: Promise<{ radarUuid: string }>;
}

export default function RadarPage({ params }: RadarPageProps) {
  const { radarUuid } = use(params);
  return <RadarInboxView radarUuid={radarUuid} />;
}
