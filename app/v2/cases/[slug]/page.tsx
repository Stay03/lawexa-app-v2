import type { Metadata } from 'next';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { fetchCaseForMetadata } from '@/lib/api/server';
import { CaseScreen } from '@/v2/features/cases/detail/CaseScreen';

/**
 * v2 `/cases/[slug]` — server shell.
 *
 * THIS IS WHAT PHASE 4 EXISTS FOR (audit part 3 §12): a pasted case link has to
 * unfurl into a real card on WhatsApp, X and LinkedIn, and it has to be
 * indexable. Neither is possible from a client component, so the page is a
 * server shell that owns `generateMetadata` and renders the `'use client'`
 * screen.
 *
 * The canonical URL is built from OUR app URL, never from the backend's
 * `meta.canonical` — the API's idea of the site origin is not authoritative for
 * the frontend, and getting that wrong points every share at the wrong host.
 */
interface CasePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const appUrl = getAppUrl().replace(/\/$/, '');
  const detail = await fetchCaseForMetadata(slug);

  // Unknown / unreadable case → the site default, already brand-prefixed, so
  // opt out of the "%s | Lawexa" template with `absolute`. Never a broken card.
  if (!detail) {
    return {
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
    };
  }

  const canonical = `${appUrl}/cases/${slug}`;
  const ogImageUrl = `${appUrl}/api/og/cases/${slug}`;

  // Prefer the backend's SEO fields when it supplies them; otherwise compose an
  // honest one from what a lawyer would want to see in a preview — the case
  // name, the court, and the year.
  const title = detail.meta?.title || detail.displayTitle;
  const description =
    detail.meta?.description ||
    detail.summary ||
    [detail.court, detail.country, detail.citation].filter(Boolean).join(' · ') ||
    SEO.defaultDescription;

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

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES. Same lever and same
 * safety argument as `app/v2/conversations/page.tsx`, which carries the full
 * note.
 *
 * WHAT THE PAYLOAD HOLDS. Only this route's metadata — head content, invisible
 * in-app — and that read is itself revalidated every five minutes server-side.
 * The case a reader SEES comes from the client query, which carries their
 * session and therefore their bookmark state and view allowance, and which has
 * its own freshness policy. Re-using this segment can only skip a round trip;
 * it cannot show anyone stale case data.
 */
export const unstable_dynamicStaleTime = 300;

export default async function V2CasePage({ params }: CasePageProps) {
  // The only await in the body: the route params, which cost no I/O. The case
  // itself is a client query — it is per-reader (bookmark state, view limits),
  // so it must not be server-rendered into a shared payload.
  const { slug } = await params;

  return <CaseScreen slug={slug} />;
}
