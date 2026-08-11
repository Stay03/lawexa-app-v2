import { ImageResponse } from 'next/og';

/**
 * Site-wide default Open Graph image (Next.js file convention).
 *
 * Applies to every route that doesn't define its own `openGraph` at all.
 * CAUTION (the merge rule that bites): a child segment that sets `openGraph`
 * replaces the ancestor's WHOLESALE — including this file's image. So a route
 * has two valid shapes:
 *   1. bespoke card → set `openGraph.images` to its own image (e.g. `/c/[id]`
 *      → `/api/og/c/[id]`);
 *   2. default card + custom og:title/description → set `openGraph` AND
 *      explicitly include `images: [{ url: '/opengraph-image', … }]`
 *      (e.g. the radar-scan page).
 * Never set `openGraph` without `images`.
 *
 * Pure text + CSS, no remote fetches, so it statically optimises at build time.
 * Twitter has no separate `twitter-image` file: with no twitter:image tag,
 * unfurlers fall back to og:image (verified: Next populates twitter:image from
 * this file when the root `twitter` card config is present).
 */
export const alt = 'Lawexa — Where Modern Legal Work Happens';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand accent (mirrors the `#C9A227` gold used in seo.ts / manifest theme_color).
const GOLD = '#C9A227';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #12131b 0%, #1a1a2e 55%, #0f1830 100%)',
        }}
      >
        {/* Gold accent rule */}
        <div
          style={{
            width: 72,
            height: 6,
            borderRadius: 999,
            backgroundColor: GOLD,
            marginBottom: 44,
          }}
        />
        {/* Wordmark */}
        <div
          style={{
            fontSize: 132,
            fontWeight: 700,
            letterSpacing: -3,
            color: '#ffffff',
          }}
        >
          Lawexa
        </div>
        {/* Tagline */}
        <div
          style={{
            fontSize: 34,
            letterSpacing: 1,
            color: '#9aa0b4',
            marginTop: 20,
          }}
        >
          Where Modern Legal Work Happens
        </div>
      </div>
    ),
    { ...size }
  );
}
