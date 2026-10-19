import { redirect } from 'next/navigation';

/**
 * v1's `/radars/[uuid]/settings`, an address people saved: the settings are the
 * `?settings=1` sheet on the radar itself in v2 (`RadarScreen`), so an old link
 * opens that sheet instead of a not-found page (v2 Stage 1, item 3).
 */
export default async function V2RadarSettingsRedirect({
  params,
}: {
  params: Promise<{ radarUuid: string }>;
}) {
  const { radarUuid } = await params;
  redirect(`/radars/${encodeURIComponent(radarUuid)}?settings=1`);
}
