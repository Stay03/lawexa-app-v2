import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getAppUrl } from '@/lib/constants/seo';
import { fetchStatuteForMetadata } from '@/lib/api/server';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

/** The card's two voices, or null when either failed to load. */
interface CardFonts {
  sans: Buffer;
  serif: Buffer;
}

/**
 * The two typefaces the card renders in, vendored beside this route because
 * satori has no system fonts and `next/font` assets are not readable from a
 * route handler:
 *
 *  - `fraunces-semibold.ttf` — the serif voice the v2 screens use, for the
 *    title (Fraunces 600, a Google Fonts static instance);
 *  - `geist-regular.ttf` — byte-for-byte the default font `@vercel/og`
 *    bundles, for everything else. It must be passed explicitly because a
 *    custom `fonts` array REPLACES the defaults (`options.fonts ||
 *    defaultFonts` in `@vercel/og`) — without it the chrome would silently
 *    turn serif, and this card's frame must match the case card's.
 *
 * Loaded once per server instance and NEVER allowed to fail the image: if
 * either read fails, no fonts are passed and the whole card renders in the
 * bundled default sans — a plainer card, not a broken one. The pair is
 * all-or-nothing so a partial failure cannot leave the chrome serif. Promise
 * cached rather than awaited at module scope so a cold start does not pay the
 * reads before the first request needs them.
 */
let cardFontsPromise: Promise<CardFonts | null> | null = null;

function loadCardFonts(): Promise<CardFonts | null> {
  const dir = join(process.cwd(), 'app', 'api', 'og', 'statutes');
  cardFontsPromise ??= Promise.all([
    readFile(join(dir, 'geist-regular.ttf')),
    readFile(join(dir, 'fraunces-semibold.ttf')),
  ]).then(
    ([sans, serif]): CardFonts | null => ({ sans, serif }),
    () => null,
  );
  return cardFontsPromise;
}

/**
 * The share card for a statute.
 *
 * Mirrors the case card's frame (same gradient, same logo placement, same
 * dimensions) so a Lawexa link looks like a Lawexa link wherever it is pasted,
 * and fills it in the statute's own voice: a gold kicker naming the country,
 * year and document type; the title in the serif the reader will meet on the
 * page; the designation ("Act 459") in gold where the case card puts its
 * citation.
 *
 * It reads through the SAME `fetchStatuteForMetadata` the page's
 * `generateMetadata` uses — unauthenticated, revalidated daily — so the unfurl
 * and the tags can never disagree, and the pair costs one upstream request
 * rather than two (which matters here: the public API group is rate-limited to
 * 60 requests/min for our whole server).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const [detail, fonts] = await Promise.all([
    fetchStatuteForMetadata(slug),
    loadCardFonts(),
  ]);

  // Satori fetches this by URL from the public directory.
  const logoUrl = `${getAppUrl().replace(/\/$/, '')}/images/logo.png`;

  if (!detail) {
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
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} height={60} alt="Lawexa" />
          <div style={{ color: '#8b8fa3', fontSize: 22, marginTop: 24 }}>
            Nigerian Legal Resources
          </div>
        </div>
      ),
      { ...SIZE },
    );
  }

  const title =
    detail.title.length > 150 ? `${detail.title.slice(0, 147)}...` : detail.title;
  const kicker = [
    detail.country,
    detail.year ? String(detail.year) : '',
    detail.documentType,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          padding: '60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} height={50} alt="Lawexa" />
          <span
            style={{
              color: '#C9A227',
              fontSize: 18,
              marginLeft: 20,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Statute
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {kicker ? (
            <div
              style={{
                color: '#C9A227',
                fontSize: 20,
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginBottom: 28,
              }}
            >
              {kicker}
            </div>
          ) : null}
          <div
            style={{
              color: '#ffffff',
              // Statute titles run long ("Advanced Fee Fraud and Other Fraud
              // Related Offences Act, 2006"), so the scale steps down rather
              // than truncating the subject out of the name.
              fontSize: title.length > 90 ? 34 : title.length > 60 ? 42 : 52,
              fontWeight: 600,
              lineHeight: 1.25,
              maxWidth: 1080,
              overflow: 'hidden',
              ...(fonts ? { fontFamily: 'Fraunces' } : {}),
            }}
          >
            {title}
          </div>
        </div>

        {detail.shortTitle ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ color: '#C9A227', fontSize: 20 }}>{detail.shortTitle}</span>
          </div>
        ) : null}
      </div>
    ),
    {
      ...SIZE,
      // Geist first: satori treats the first font as the default family, so
      // everything without an explicit `fontFamily` stays in the sans chrome.
      ...(fonts
        ? {
            fonts: [
              {
                name: 'Geist',
                data: fonts.sans,
                weight: 400 as const,
                style: 'normal' as const,
              },
              {
                name: 'Fraunces',
                data: fonts.serif,
                weight: 600 as const,
                style: 'normal' as const,
              },
            ],
          }
        : {}),
    },
  );
}
