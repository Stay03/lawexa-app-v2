'use client';

import { use } from 'react';

import { RadarInboxView } from '@/components/radar/RadarInboxView';

interface RadarSettingsPageProps {
  params: Promise<{ radarUuid: string }>;
}

/**
 * Deep link to the setup drawer: renders the radar inbox with the settings
 * sheet pre-opened. Closing the sheet shallow-rewrites the URL back to the
 * inbox without remounting.
 */
export default function RadarSettingsPage({ params }: RadarSettingsPageProps) {
  const { radarUuid } = use(params);
  return <RadarInboxView radarUuid={radarUuid} initialSettingsOpen />;
}
