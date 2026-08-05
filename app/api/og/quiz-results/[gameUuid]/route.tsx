import { ImageResponse } from 'next/og';
import { fetchPublicQuizResults } from '@/lib/api/server';
import { getAppUrl } from '@/lib/constants/seo';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

/**
 * The share card for a finished channel quiz.
 *
 * Mirrors the frame the case and conversation cards use — same gradient, same
 * logo placement, same dimensions — so a Lawexa link looks like a Lawexa link
 * wherever it is pasted, and fills it with the one thing a scoreboard is
 * actually about: who won, and by how much.
 *
 * IT READS THE SAME PUBLIC ENDPOINT the page does — through the same
 * `lib/api/server.ts` reader, unauthenticated and cached for the same five
 * minutes — so the unfurl and the page can never disagree, the pair costs one
 * upstream request rather than two, and neither pulls a browser-only client
 * (`apiClient`, the auth store) into a server module's graph.
 *
 * NO FACES. Satori would have to fetch every avatar from wherever it is hosted,
 * on the crawler's clock, and a card that renders slowly renders as nothing —
 * so the podium here is names and numbers, which is all the preview has room to
 * say anyway.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameUuid: string }> },
) {
  const { gameUuid } = await params;
  const results = await fetchPublicQuizResults(gameUuid);

  // Satori fetches this by URL from the public directory.
  const logoUrl = `${getAppUrl().replace(/\/$/, '')}/images/logo.png`;

  const frame = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    background:
      'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    padding: '60px',
  };

  if (!results) {
    return new ImageResponse(
      (
        <div
          style={{
            ...frame,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} height={60} alt="Lawexa" />
          <div style={{ color: '#8b8fa3', fontSize: 22, marginTop: 24 }}>
            Live quizzes in Lawexa Spaces
          </div>
        </div>
      ),
      { ...SIZE },
    );
  }

  const winner = results.podium[0];
  const runners = results.podium.slice(1);
  const title = results.quiz_title;
  const meta = [
    `${results.question_count} ${results.question_count === 1 ? 'question' : 'questions'}`,
    `${results.player_count} ${results.player_count === 1 ? 'player' : 'players'}`,
  ].join('  ·  ');

  return new ImageResponse(
    (
      <div style={frame}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
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
            Quiz · final scores
          </span>
        </div>

        <div
          style={{
            color: '#ffffff',
            // Steps down rather than truncating a title out of recognition.
            fontSize: title.length > 60 ? 40 : title.length > 34 ? 50 : 60,
            fontWeight: 'bold',
            lineHeight: 1.15,
            maxWidth: 1080,
            overflow: 'hidden',
          }}
        >
          {title.length > 110 ? `${title.slice(0, 107)}...` : title}
        </div>

        <div style={{ display: 'flex', color: '#8b8fa3', fontSize: 22, marginTop: 12 }}>
          {meta}
        </div>

        {/* THE HERO. One number, as large as the frame allows — a preview is
            read at thumbnail size, and the winner's score is the only thing
            that survives that. */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          {winner ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#8b8fa3', fontSize: 20, letterSpacing: 2 }}>
                WINNER
              </span>
              <span style={{ color: '#ffffff', fontSize: 40, marginTop: 6 }}>
                {winner.name.length > 28
                  ? `${winner.name.slice(0, 25)}...`
                  : winner.name}
              </span>
              <span
                style={{
                  color: '#C9A227',
                  fontSize: 96,
                  fontWeight: 'bold',
                  lineHeight: 1,
                  marginTop: 8,
                }}
              >
                {results.top_score.toLocaleString('en-NG')}
              </span>
            </div>
          ) : (
            <span style={{ color: '#8b8fa3', fontSize: 28 }}>
              Nobody made the board
            </span>
          )}

          {runners.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 10,
              }}
            >
              {runners.map((row) => (
                <span
                  key={`${row.rank}-${row.name}`}
                  style={{ color: '#8b8fa3', fontSize: 26 }}
                >
                  {row.rank}. {row.name.length > 22 ? `${row.name.slice(0, 19)}...` : row.name}
                  {'  ·  '}
                  {row.score.toLocaleString('en-NG')}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
