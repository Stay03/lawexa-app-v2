import type { Metadata } from 'next';
import { HydrationBoundary } from '@tanstack/react-query';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { prefetchStatutesListState } from '@/v2/features/statutes/server';
import { StatutesScreen } from '@/v2/features/statutes/list/StatutesScreen';

/**
 * v2 `/statutes` — server shell for the statute library.
 *
 * A PUBLIC, INDEXED SURFACE, so it gets the full metadata treatment the cases
 * library established: real title, description, canonical URL, an OG card and
 * `robots: index`.
 */
export function generateMetadata(): Metadata {
  const canonical = `${getAppUrl().replace(/\/$/, '')}/statutes`;
  const title = 'Statute Library';
  const description =
    'Browse and search statutes, acts, and constitutions from Nigeria, Ghana and across Africa — full text, structured for reading.';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SEO.siteName,
      type: 'website',
      locale: SEO.locale,
    },
    twitter: {
      // `summary`, not `summary_large_image` — statutes have no OG image
      // route yet (it is on the backend-asks list), and a large-image card
      // with no image in the chain renders worse than the plain card.
      card: 'summary',
      title,
      description,
      site: SEO.twitterHandle,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * the same safety argument as `app/v2/cases/(library)/page.tsx`, which carries
 * the full note: the payload holds page 1 of a reference-tier list whose own
 * staleTime is ten minutes, so reusing the segment can only skip a round trip
 * that would have produced the same rows.
 */
export const unstable_dynamicStaleTime = 300;

/**
 * THE FILTERS ARE READ HERE so the prefetched entry is the one the client
 * will actually read: `StatutesBrowser` keys its query on `search` and the
 * resolved country id, so prefetching a bare page-1 while the URL says
 * `?country=ghana` would hydrate a key nobody reads. This only runs on a HARD
 * load or an external link — the client writes filters with the native
 * history API and never navigates back through here.
 */
export default async function V2StatutesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; country?: string }>;
}) {
  const { search, country } = await searchParams;

  // AWAITED on purpose — see `prefetchStatutesListState`: public surface, the
  // rows belong in the first-paint HTML. Bounded by its own timeout; never
  // throws; skipped (undefined) for signed-out visitors, whose requests the
  // API answers with 401 anyway.
  const state = await prefetchStatutesListState({
    search: search?.trim() || undefined,
    countrySlug: country?.trim() || undefined,
  });

  return (
    <HydrationBoundary state={state}>
      <StatutesScreen />
    </HydrationBoundary>
  );
}
