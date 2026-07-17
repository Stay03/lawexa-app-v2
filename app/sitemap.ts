import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/constants/seo';

/**
 * Static top-level public routes, served by Next.js at /sitemap.xml.
 *
 * Per-document entries (individual cases, notes, statutes, and shared
 * conversations) are deferred to phase 4 — they land once the server metadata
 * shells for those detail routes exist and can enumerate published slugs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
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

  return paths.map((path) => ({
    // Root maps to the bare origin (no trailing slash) to match the canonical URL.
    url: path === '/' ? appUrl : `${appUrl}${path}`,
    lastModified,
  }));
}
