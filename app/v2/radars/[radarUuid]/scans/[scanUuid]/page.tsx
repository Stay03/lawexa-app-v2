import type { Metadata } from 'next';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { fetchScanForMetadata } from '@/lib/api/server';
import { ScanReportScreen } from '@/v2/features/radars/report/ScanReportScreen';

/**
 * v2 `/radars/[radarUuid]/scans/[scanUuid]` — server shell for a scan report.
 *
 * THE ONE RADAR ROUTE WITH REAL METADATA, because it is the one radar URL a
 * stranger can hold: a published report's share link must unfurl with its
 * title and lede. `fetchScanForMetadata` reads the PUBLIC endpoint (shared
 * `lib/api/server.ts`, revalidated 60s), so the tags describe exactly what an
 * anonymous visitor would see and nothing more.
 *
 * INDEXABILITY follows what the public endpoint answers — v1's proven rule,
 * with the fallback made explicit: a PUBLISHED scan is `index: true` with a
 * canonical (v1 shipped exactly this); a PRIVATE/unknown scan falls back to
 * the default site card with `noindex` (v1 left robots unset there — but a
 * URL that resolves to a sign-in wall or 404 for a crawler has no business
 * inviting the crawl, so v2 says so).
 */
interface ReportPageProps {
  params: Promise<{ radarUuid: string; scanUuid: string }>;
}

/**
 * Plain-text description from the markdown report: drop the trailing
 * "## Sources" section, strip common markdown syntax, collapse whitespace,
 * cap at metadata length. (v1's builder, ported.)
 */
function buildDescription(report: string | null): string | null {
  if (!report) return null;
  const body = report.split('\n## Sources')[0];
  const plain = body
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
}

export async function generateMetadata({
  params,
}: ReportPageProps): Promise<Metadata> {
  const { radarUuid, scanUuid } = await params;
  const appUrl = getAppUrl().replace(/\/$/, '');
  const scan = await fetchScanForMetadata(radarUuid, scanUuid);

  // Private / unknown scans (404 from the public endpoint): the default site
  // card, explicitly not indexed — nothing about the report may leak.
  if (!scan) {
    return {
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
      robots: { index: false, follow: false },
    };
  }

  const title = scan.title?.trim() || 'Radar report';
  const description = buildDescription(scan.report) ?? SEO.defaultDescription;
  const canonical = `${appUrl}/radars/${radarUuid}/scans/${scanUuid}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SEO.siteName,
      type: 'article',
      locale: SEO.locale,
      // The site-wide default card, referenced explicitly — a child
      // `openGraph` replaces the ancestor's wholesale, which would otherwise
      // silently drop it (scans have no bespoke share image).
      images: [
        {
          url: '/opengraph-image',
          width: SEO.ogImageWidth,
          height: SEO.ogImageHeight,
          alt: SEO.siteName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: SEO.twitterHandle,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the payload holds
 * only head metadata (revalidated 60s server-side); the report a reader SEES
 * comes from the client query with its own 10s-while-running policy.
 */
export const unstable_dynamicStaleTime = 300;

export default async function V2ScanReportPage({ params }: ReportPageProps) {
  const { radarUuid, scanUuid } = await params;
  return <ScanReportScreen radarUuid={radarUuid} scanUuid={scanUuid} />;
}
