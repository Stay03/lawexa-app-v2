import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/constants/seo';
import {
  fetchCaseSitemapEntries,
  fetchStatuteSitemapEntries,
} from '@/lib/api/server';

/**
 * /sitemap.xml — the static top-level routes, plus one entry per case and per
 * statute.
 *
 * PER-DOCUMENT ENTRIES LAND PER DOMAIN, as each one gets its server metadata
 * shell. Cases are in (phase 4: `app/v2/cases/[slug]` exports
 * `generateMetadata` and an OG card, so a listed URL resolves to a real,
 * indexable page). STATUTES ARE LIVE AS OF AUGUST 2, 2026: the backend's
 * public feed (`GET /api/public/statutes`, slug + `updated_at`, no token)
 * enumerates the catalog in two requests of 1,000, and the statute page's
 * metadata now reads a public summary — so every listed statute URL describes
 * itself to a crawler. Notes and shared conversations follow with their own
 * shells — listing a URL whose page cannot describe itself would be worse
 * than not listing it.
 *
 * ⚠️ THE CASE BLOCK IS EMPTY IN PRODUCTION TODAY. `GET /api/cases` requires a
 * bearer token (measured July 25, 2026) and neither a crawler nor a build has
 * one, so `fetchCaseSitemapEntries` returns nothing and cases contribute no
 * entries. The wiring is deliberately left in place — it is correct the
 * moment an unauthenticated slug index exists (Question 3 in
 * `docs/v2-docs/backend-ask-2026-07-25-cases-read-endpoints.md`). Stated here
 * rather than left to be discovered: a sitemap that silently lists nothing looks
 * exactly like a sitemap that is working.
 *
 * Both walks are BOUNDED and never throw: see `fetchCaseSitemapEntries` and
 * `fetchStatuteSitemapEntries`, which state their caps and degrade to empty
 * lists on any upstream failure so a build can never fail on them.
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

  const [cases, statutes] = await Promise.all([
    fetchCaseSitemapEntries(),
    fetchStatuteSitemapEntries(),
  ]);

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

  const statuteEntries: MetadataRoute.Sitemap = statutes.map((entry) => {
    // `updated_at` reflects body edits too (backend-confirmed), so it is an
    // honest `lastmod` as-is; same omit-over-invent rule as cases.
    const parsed = entry.lastModified ? Date.parse(entry.lastModified) : NaN;
    return {
      url: `${appUrl}/statutes/${entry.slug}`,
      ...(Number.isNaN(parsed) ? {} : { lastModified: new Date(parsed) }),
      changeFrequency: 'monthly' as const,
    };
  });

  return [...staticEntries, ...caseEntries, ...statuteEntries];
}
