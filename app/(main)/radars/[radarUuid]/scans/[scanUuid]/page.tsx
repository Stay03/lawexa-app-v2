import type { Metadata } from 'next';
import { fetchScanForMetadata } from '@/lib/api/server';
import { SEO, getAppUrl } from '@/lib/constants/seo';
import ReportClient from './report-client';

interface ReportPageProps {
  params: Promise<{ radarUuid: string; scanUuid: string }>;
}

/**
 * Build a plain-text description from the markdown report: drop the trailing
 * "## Sources" section, strip common markdown syntax, collapse whitespace, cap.
 */
function buildDescription(report: string | null): string | null {
  if (!report) return null;
  const body = report.split('\n## Sources')[0];
  const plain = body
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/[*_`>#-]/g, ' ') // markdown punctuation
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const { radarUuid, scanUuid } = await params;
  const appUrl = getAppUrl();
  const scan = await fetchScanForMetadata(radarUuid, scanUuid);

  // Private / unknown scans (404 from the public endpoint) fall back to the
  // default site card so nothing leaks.
  if (!scan) {
    return {
      // `absolute` opts out of the root "%s | Lawexa" template so this stays
      // exactly "Lawexa - Nigerian Legal Resources" (defaultTitle is already
      // brand-prefixed).
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
    };
  }

  const title = scan.title?.trim() || 'Radar report';
  const description = buildDescription(scan.report) ?? SEO.defaultDescription;
  const canonicalUrl = `${appUrl}/radars/${radarUuid}/scans/${scanUuid}`;

  return {
    // Bare title — the root "%s | Lawexa" template adds the brand suffix,
    // giving "<title> | Lawexa" instead of the old double-branded prefix.
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SEO.siteName,
      type: 'article',
      locale: SEO.locale,
      // A child `openGraph` replaces the ancestor's WHOLESALE, which would
      // silently drop the site-wide default card from `app/opengraph-image.tsx`
      // — so reference it explicitly (metadataBase makes it absolute). Scans
      // have no bespoke share image (unlike /c/[id]).
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

export default function ReportPage() {
  return <ReportClient />;
}
