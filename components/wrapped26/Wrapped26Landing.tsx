import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * lawexa.com/wrapped for someone without a 2026 Wrapped once the 2026 window
 * is open: a friend who tapped a shared link, or an account with no record.
 * Arthur's words (thread f833c285, 21 November 2026); the layout is the Bar
 * Finals landing's (app/wrapped/wrapped.css). A share's `?r=CODE` is kept
 * through sign-up by lib/utils/attribution.ts. The example card is marked as
 * an example and shows no real person.
 */
export function Wrapped26Landing({ signedIn, reason }: { signedIn: boolean; reason?: 'not-ready' | 'hidden' }) {
  return (
    <main className="wr-landing">
      <div className="wr-landing-inner">
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ font: '900 1.1rem/1 var(--wr-display)', color: 'inherit', textDecoration: 'none' }}>
            Lawexa
          </Link>
          {signedIn ? null : (
            <Link href="/login?redirect=/wrapped" style={{ font: '700 0.95rem/1 var(--wr-body)', color: 'inherit' }}>
              Sign in
            </Link>
          )}
        </header>

        <section style={{ display: 'grid', gap: 40, alignItems: 'center', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
          <div style={{ display: 'grid', gap: 20 }}>
            <p style={{ font: '700 0.95rem/1 var(--wr-body)', color: 'var(--wr-ink)' }}>Lawexa Wrapped 2026</p>
            <h1>
              Your 2026 on Lawexa. <span className="wr-mark">See the character your year earned you.</span>
            </h1>
            {reason === 'hidden' ? (
              <p>
                You&rsquo;ve hidden your Wrapped. Turn it back on in <Link href="/settings/profile">Profile</Link>.
              </p>
            ) : reason === 'not-ready' ? (
              <p>There&rsquo;s no Wrapped 2026 on this account: it covers accounts that used Lawexa this year.</p>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {signedIn ? (
                <Link className="wr-cta" href="/">
                  Open Lawexa <ArrowRight aria-hidden size={18} />
                </Link>
              ) : (
                <>
                  <Link className="wr-cta" data-tone="gold" href="/register">
                    Get yours <ArrowRight aria-hidden size={18} />
                  </Link>
                  <Link className="wr-cta" href="/login?redirect=/wrapped">
                    I have an account
                  </Link>
                </>
              )}
            </div>
          </div>

          <figure style={{ justifySelf: 'center', width: 'min(100%, 320px)', margin: 0 }}>
            <div
              aria-hidden
              style={{
                aspectRatio: '4 / 5',
                background: 'var(--wr-ink)',
                color: 'var(--wr-cream)',
                border: '4px solid var(--wr-ink)',
                boxShadow: '12px 12px 0 var(--wr-lime)',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transform: 'rotate(3deg)',
              }}
            >
              <span style={{ font: '700 0.7rem/1 var(--wr-body)', letterSpacing: '0.3em' }}>ADAEZE&rsquo;S WRAPPED 2026</span>
              <span>
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'var(--wr-cream)',
                    color: 'var(--wr-ink)',
                    border: '4px solid var(--wr-lime)',
                    font: '900 2rem/1 var(--wr-display)',
                  }}
                >
                  A
                </span>
                <span style={{ display: 'block', marginTop: 12, font: '900 2rem/1 var(--wr-display)' }}>Adaeze</span>
                <span style={{ display: 'block', marginTop: 8, font: '900 1rem/1 var(--wr-display)', color: 'var(--wr-lime)' }}>as Mike Ross</span>
              </span>
              <span style={{ font: '700 0.7rem/1 var(--wr-body)', letterSpacing: '0.1em' }}>LAWEXA.COM/WRAPPED</span>
            </div>
            <figcaption style={{ marginTop: 22, textAlign: 'center', font: '500 0.85rem/1.4 var(--wr-body)', color: 'var(--wr-ink-muted)' }}>
              An example card, with a made-up name.
            </figcaption>
          </figure>
        </section>

        <footer>
          <p style={{ fontSize: '0.9rem' }}>Only you see your Wrapped. Nothing posts unless you press Share.</p>
        </footer>
      </div>
    </main>
  );
}
