import type { Metadata } from 'next';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { fetchStatuteForMetadata } from '@/v2/features/statutes/server';
import { StatuteScreen } from '@/v2/features/statutes/reader/StatuteScreen';

/**
 * v2 `/statutes/[slug]` — server shell. Owns `generateMetadata`; the client
 * screen owns everything a reader sees (the cases `[slug]` convention).
 *
 * THE METADATA READ IS SESSION-AUTHENTICATED, unlike the case page's — it has
 * to be: `GET /statutes/{slug}` answers 401 without a bearer token (measured
 * July 31, 2026), so there is no unauthenticated read to shared-cache. A
 * signed-in hard load gets full metadata; a crawler or signed-out visitor
 * gets the site-default card — which is honest, since the data is auth-walled
 * for them anyway. `fetchStatuteForMetadata` carries the full note, including
 * why its response must never enter Next's shared data cache.
 */
interface StatutePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: StatutePageProps): Promise<Metadata> {
  const { slug } = await params;
  const appUrl = getAppUrl().replace(/\/$/, '');
  const detail = await fetchStatuteForMetadata(slug);

  // Unknown / unreadable statute → the site default, already brand-prefixed,
  // so opt out of the "%s | Lawexa" template. Never a broken card.
  if (!detail) {
    return {
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
    };
  }

  const canonical = `${appUrl}/statutes/${slug}`;
  const title = detail.shortTitle
    ? `${detail.title} (${detail.shortTitle})`
    : detail.title;
  const description =
    detail.summary ||
    [detail.country, detail.year].filter(Boolean).join(' · ') ||
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
    },
    twitter: {
      // `summary`, not `summary_large_image` — no statutes OG image exists
      // yet (backend-asks list), and a large-image card with no image in the
      // chain renders worse than the plain card.
      card: 'summary',
      title,
      description,
      site: SEO.twitterHandle,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the cases `[slug]`
 * lever and safety argument: the payload holds only head content; the statute
 * a reader SEES comes from the client queries, which carry their session and
 * their own freshness policy.
 */
export const unstable_dynamicStaleTime = 300;

export default async function V2StatutePage({ params }: StatutePageProps) {
  // The only await in the body: the route params, which cost no I/O. The
  // statute itself is a client query (per-reader bookmark state), and the AKN
  // XML is DELIBERATELY not prefetched — `StatuteDocument` carries the full
  // argument (a 275–880 KB string serialized into the flight payload would
  // hold first paint hostage to the route's heaviest asset).
  const { slug } = await params;

  return <StatuteScreen slug={slug} />;
}
