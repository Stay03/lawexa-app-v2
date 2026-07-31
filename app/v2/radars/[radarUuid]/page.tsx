import type { Metadata } from 'next';
import { RadarScreen } from '@/v2/features/radars/detail/RadarScreen';

/**
 * v2 `/radars/[radarUuid]` — server shell for one radar's inbox.
 *
 * PRIVATE surface: the radar detail endpoint 403s for anyone but the owner,
 * so there is no crawler-visible content and the metadata is a bare generic
 * title + noindex (the conversations precedent). The radar's real NAME is
 * per-user data — it reaches the tab through the client's header context, not
 * through a server fetch that would put a private string in a shared payload
 * and a Laravel round trip in front of every hard load.
 *
 * The old `/radars/[uuid]/settings` and `/radars/[uuid]/scan-log` routes are
 * deliberately NOT recreated: settings is the `?settings=1` quiet-URL sheet
 * and the scan log is the "All activity" tab (owner decision D3), both inside
 * this one route.
 */
interface RadarPageProps {
  params: Promise<{ radarUuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Radar',
    description: 'Reports from one of your saved watches.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/radars` above it. */
export const unstable_dynamicStaleTime = 300;

export default async function V2RadarPage({ params }: RadarPageProps) {
  const { radarUuid } = await params;
  return <RadarScreen radarUuid={radarUuid} />;
}
