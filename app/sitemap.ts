import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/constants/seo';
import { fetchCaseSitemapEntries } from '@/lib/api/server';

/**
 * /sitemap.xml — the static top-level routes, plus one entry per case.
 *
 * PER-DOCUMENT ENTRIES LAND PER DOMAIN, as each one gets its server metadata
 * shell. Cases are in (phase 4, this round: `app/v2/cases/[slug]` exports
 * `generateMetadata` and an OG card, so a listed URL now resolves to a real,
 * indexable page). Notes, statutes and shared conversations follow with their
 * own shells — listing a URL whose page cannot describe itself would be worse
 * than not listing it.
 *
 * ⚠️ THE CASE BLOCK IS EMPTY IN PRODUCTION TODAY. `GET /api/cases` requires a
 * bearer token (measured July 25, 2026) and neither a crawler nor a build has
 * one, so `fetchCaseSitemapEntries` returns nothing and this ships the eight
 * static routes. The wiring is deliberately left in place — it is correct the
 * moment an unauthenticated slug index exists (Question 3 in
 * `docs/v2-docs/backend-ask-2026-07-25-cases-read-endpoints.md`). Stated here
 * rather than left to be discovered: a sitemap that silently lists nothing looks
 * exactly like a sitemap that is working.
 *
 * The walk is BOUNDED and never throws: see `fetchCaseSitemapEntries`, which
 * states the cap and degrades to an empty list on any upstream failure so a
 * build can never fail on it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Raw concat below — strip any trailing slash so a `NEXT_PUBLIC_APP_URL`
  // ending in '/' can't produce 'https://host//cases'.
  const appUrl = getAppUrl().replace(/\/$/, '');
  const lastModified = new Date();

  const paths = [
    '/',
    '/cases',
    '/statutes',
    '/notes',
    '/pricing',
    '/terms',
    '/privacy',
    '/shared',
  ];

  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => ({
    // Root maps to the bare origin (no trailing slash) to match the canonical URL.
    url: path === '/' ? appUrl : `${appUrl}${path}`,
    lastModified,
  }));

  const cases = await fetchCaseSitemapEntries();
  const caseEntries: MetadataRoute.Sitemap = cases.map((entry) => {
    const parsed = entry.lastModified ? Date.parse(entry.lastModified) : NaN;
    return {
      url: `${appUrl}/cases/${entry.slug}`,
      // Omit `lastModified` rather than invent one: telling a crawler a case
      // changed today, every day, is worse than telling it nothing.
      ...(Number.isNaN(parsed) ? {} : { lastModified: new Date(parsed) }),
      changeFrequency: 'monthly' as const,
    };
  });

  return [...staticEntries, ...caseEntries];
}
