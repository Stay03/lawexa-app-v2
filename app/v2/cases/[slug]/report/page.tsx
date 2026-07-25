import type { Metadata } from 'next';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { fetchCaseForMetadata } from '@/lib/api/server';
import { CaseReportScreen } from '@/v2/features/cases/report/CaseReportScreen';

/**
 * v2 `/cases/[slug]/report` — server shell for the full judgment.
 *
 * Metadata points its canonical at the CASE, not at itself. The report is the
 * same document at greater length, so letting both URLs compete for the same
 * search result splits their ranking and gives readers the wrong entry point —
 * the summary, with its holding and its citations, is the page a search should
 * land on. `robots: index` stays on so the text is crawlable; the canonical is
 * what tells a search engine which URL to show.
 */
interface ReportPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const { slug } = await params;
  const appUrl = getAppUrl().replace(/\/$/, '');
  const detail = await fetchCaseForMetadata(slug);

  if (!detail) {
    return {
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
    };
  }

  const title = `${detail.displayTitle} — full judgment`;
  const description =
    detail.summary ||
    [detail.court, detail.country, detail.citation].filter(Boolean).join(' · ') ||
    SEO.defaultDescription;
  const ogImageUrl = `${appUrl}/api/og/cases/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: `${appUrl}/cases/${slug}` },
    openGraph: {
      title,
      description,
      url: `${appUrl}/cases/${slug}/report`,
      siteName: SEO.siteName,
      type: 'article',
      locale: SEO.locale,
      images: [
        {
          url: ogImageUrl,
          width: SEO.ogImageWidth,
          height: SEO.ogImageHeight,
          alt: detail.displayTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: SEO.twitterHandle,
      images: [ogImageUrl],
    },
    robots: { index: true, follow: true },
  };
}

/** Same lever and argument as the case page above it. */
export const unstable_dynamicStaleTime = 300;

export default async function V2CaseReportPage({ params }: ReportPageProps) {
  const { slug } = await params;
  return <CaseReportScreen slug={slug} />;
}
