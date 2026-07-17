import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/constants/seo';

/**
 * Site-wide crawl policy, served by Next.js at /robots.txt.
 *
 * Public content is fully crawlable. Authenticated/internal surfaces (/admin,
 * /settings), the hidden v2 preview tree (/v2), and internal API routes (/api)
 * are disallowed.
 *
 * `/api/og` is explicitly re-allowed: the per-conversation share card lives at
 * `/api/og/c/[id]`, and social crawlers (facebookexternalhit, Twitterbot,
 * Slackbot, …) must be able to fetch it. Major crawlers honour the more specific
 * Allow over the broader Disallow, so this keeps the existing rich previews
 * working while still hiding the rest of the API surface.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/og'],
      disallow: ['/admin', '/settings', '/v2', '/api'],
    },
    sitemap: `${getAppUrl().replace(/\/$/, '')}/sitemap.xml`,
  };
}
