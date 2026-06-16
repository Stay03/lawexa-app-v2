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
      title: SEO.defaultTitle,
      description: SEO.defaultDescription,
    };
  }

  const title = scan.title?.trim() || 'Radar report';
  const description = buildDescription(scan.report) ?? SEO.defaultDescription;
  const canonicalUrl = `${appUrl}/radars/${radarUuid}/scans/${scanUuid}`;

  return {
    title: `Lawexa - ${title}`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SEO.siteName,
      type: 'article',
      locale: SEO.locale,
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
