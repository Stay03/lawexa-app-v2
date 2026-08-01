import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { fetchStatuteForMetadata } from '@/v2/features/statutes/server';
import {
  formatProvisionLabel,
  parseProvisionSegment,
  type ProvisionCitation,
} from '@/v2/features/statutes/reader/provision';
import { StatuteScreen } from '@/v2/features/statutes/reader/StatuteScreen';

/**
 * v2 `/statutes/[slug]` and `/statutes/[slug]/section-54[-2]` — server shell.
 * Owns `generateMetadata`; the client screen owns everything a reader sees
 * (the cases `[slug]` convention).
 *
 * THE OPTIONAL CATCH-ALL: one page renders BOTH the plain statute URL and the
 * citation-shaped deep link (`section-54`, `section-54-2` — see
 * `v2/features/statutes/reader/provision.ts` for the grammar). One provision
 * segment is accepted and handed to the client untouched — resolving it needs
 * the parsed document, so an unknown or garbage segment is NOT a 404 here:
 * the statute renders normally and the reader says, quietly, that the cited
 * provision was not found. Deeper paths are nobody's citation and 404.
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
  params: Promise<{ slug: string; provision?: string[] }>;
}

/** The one accepted provision segment's citation, or null. Never throws —
 *  route-level rejection of deep paths belongs to the page body's guard. */
function citationOf(provision: string[] | undefined): ProvisionCitation | null {
  if (!provision || provision.length !== 1) return null;
  return parseProvisionSegment(provision[0]);
}

export async function generateMetadata({
  params,
}: StatutePageProps): Promise<Metadata> {
  const { slug, provision } = await params;

  // Mirror the page's depth guard: anything deeper than one provision
  // segment renders the 404 boundary, so it gets the noindex site default —
  // never real statute metadata, and never the authenticated metadata read.
  if (provision && provision.length > 1) {
    return {
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
      robots: { index: false, follow: false },
    };
  }

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

  // The canonical is ALWAYS the plain statute URL: a section is a fragment of
  // one document, and a fragment URL must consolidate into — never compete
  // with — the statute page in search.
  const canonical = `${appUrl}/statutes/${slug}`;
  const statuteTitle = detail.shortTitle
    ? `${detail.title} (${detail.shortTitle})`
    : detail.title;
  // A citation-shaped arrival names its target in the title —
  // "Section 54 — Courts Act, 1993 (Act 459)". The server cannot know whether
  // the document holds that section; the reader answers that honestly.
  const citation = citationOf(provision);
  const title = citation
    ? `${formatProvisionLabel(citation)} — ${statuteTitle}`
    : statuteTitle;
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
  const { slug, provision } = await params;

  // At most ONE provision segment. Anything deeper is not a citation this
  // grammar can ever mint — a real 404, not a reader-level miss.
  if (provision && provision.length > 1) notFound();

  return <StatuteScreen slug={slug} provision={provision?.[0] ?? null} />;
}
