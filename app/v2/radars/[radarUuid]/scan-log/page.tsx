import { redirect } from 'next/navigation';

/**
 * v1's `/radars/[uuid]/scan-log`, an address people saved: the scan log is the
 * radar's "All activity" tab in v2 (`?tab=activity`, owner decision D3), so an
 * old link opens that tab instead of a not-found page (v2 Stage 1, item 3).
 */
export default async function V2RadarScanLogRedirect({
  params,
}: {
  params: Promise<{ radarUuid: string }>;
}) {
  const { radarUuid } = await params;
  redirect(`/radars/${encodeURIComponent(radarUuid)}?tab=activity`);
}
