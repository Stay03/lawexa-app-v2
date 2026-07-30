import type { Metadata } from 'next';
import { HydrationBoundary } from '@tanstack/react-query';

import { SEO, getAppUrl } from '@/lib/constants/seo';
import { prefetchCasesListState } from '@/v2/features/cases/server';
import { CasesScreen } from '@/v2/features/cases/list/CasesScreen';

/**
 * v2 `/cases` — server shell for the case library.
 *
 * Follows the v2 metadata convention (app/v2/layout.tsx docblock): a server
 * `page.tsx` exporting `generateMetadata` that renders a `'use client'` child.
 *
 * UNLIKE `/conversations`, THIS IS A PUBLIC SURFACE. It is in `sitemap.ts`, it
 * is what a search engine sees for "Nigerian case law", and a guest can read it.
 * So it gets the full treatment — real title, description, canonical URL, an OG
 * card and `robots: index` — where the private conversations list gets a bare
 * title and `noindex`.
 */
export function generateMetadata(): Metadata {
  const canonical = `${getAppUrl().replace(/\/$/, '')}/cases`;
  const title = 'Case Library';
  const description =
    'Browse and search Nigerian and African case law — judgments, holdings, and the citations between them.';

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
      card: 'summary_large_image',
      title,
      description,
      site: SEO.twitterHandle,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES. Same lever and same
 * safety argument as `app/v2/conversations/page.tsx`, which carries the full
 * note: the route is dynamic (the v2 layout reads the session cookie) and Next's
 * default `staleTimes.dynamic` is 0, so without this every return trip re-fetches
 * the segment and `loading.tsx` covers rows the query cache already holds.
 *
 * WHAT THE PAYLOAD HOLDS HERE, AND WHY THAT IS SAFE. Unlike the conversations
 * page, this segment DOES await data: page 1 of the browse list, prefetched and
 * dehydrated below. Re-using it for five minutes means a reader who comes back
 * inside that window sees the page-1 rows the server rendered earlier — which is
 * exactly what the query cache would have shown them anyway (the list's own
 * `reference` staleTime is ten minutes), and the hydrated query still refetches
 * on its own schedule. The list cannot go more stale than its data policy allows;
 * the cache only removes a round trip that would have produced the same rows.
 */
export const unstable_dynamicStaleTime = 300;

/**
 * THE FILTERS ARE READ HERE, so the prefetched entry is the one the client will
 * actually read. `CasesBrowser` keys its query on `search` and `tags`, so
 * prefetching a bare unfiltered page-1 while the URL says `?search=mareva` would
 * hydrate a key nobody reads — one wasted request AND a skeleton on a shared
 * link, which is the opposite of the point.
 *
 * This only ever runs for a HARD load or an external link: the client writes
 * filters with the native history API and never navigates, so typing in the
 * search box does not come back through here.
 *
 * Trending is deliberately NOT prefetched. It is the secondary view behind a
 * tab, it is not indexed, and fetching a ranking nobody asked for on every
 * `/cases` load would cost a request per visit to save one on a minority of them.
 */
export default async function V2CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tags?: string; view?: string }>;
}) {
  const { search, tags, view } = await searchParams;

  // AWAITED on purpose — see `prefetchCasesListState`. This is a public, indexed
  // surface, so the rows have to be in the first-paint HTML: a crawler does not
  // run our queries, and a reader arriving from search should see cases rather
  // than a skeleton. The prefetch is bounded by its own timeout and never throws.
  const state =
    view === 'trending'
      ? undefined
      : await prefetchCasesListState({
          search: search?.trim() || undefined,
          tags: tags?.trim() || undefined,
        });

  return (
    <HydrationBoundary state={state}>
      <CasesScreen />
    </HydrationBoundary>
  );
}
