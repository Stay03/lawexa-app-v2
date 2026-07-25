import { ImageResponse } from 'next/og';
import { getAppUrl } from '@/lib/constants/seo';
import { fetchCaseForMetadata } from '@/lib/api/server';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

/**
 * The share card for a case.
 *
 * Mirrors the conversation card's frame (same gradient, same logo placement,
 * same dimensions) so a Lawexa link looks like a Lawexa link wherever it is
 * pasted, and fills it with what a lawyer scanning a preview actually needs:
 * the case name, then the court, country and date under it.
 *
 * It reads through the SAME `fetchCaseForMetadata` the page's `generateMetadata`
 * uses — unauthenticated and revalidated — so the unfurl and the tags can never
 * disagree, and the pair costs one upstream request rather than two.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const detail = await fetchCaseForMetadata(slug);

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

  const title = detail.displayTitle;
  const year = detail.judgmentDate
    ? String(new Date(detail.judgmentDate).getUTCFullYear())
    : '';
  const meta = [detail.court, detail.country, year].filter(Boolean).join('  ·  ');

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
            Case
          </span>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <div
            style={{
              color: '#ffffff',
              // Long case names are the norm, so the scale steps down rather
              // than truncating a party out of the citation.
              fontSize: title.length > 90 ? 34 : title.length > 60 ? 42 : 52,
              fontWeight: 'bold',
              lineHeight: 1.25,
              maxWidth: 1080,
              overflow: 'hidden',
            }}
          >
            {title.length > 150 ? `${title.slice(0, 147)}...` : title}
          </div>
        </div>

        {meta ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ color: '#8b8fa3', fontSize: 20 }}>{meta}</span>
          </div>
        ) : null}

        {detail.citation ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ color: '#C9A227', fontSize: 20 }}>{detail.citation}</span>
          </div>
        ) : null}
      </div>
    ),
    { ...SIZE },
  );
}
