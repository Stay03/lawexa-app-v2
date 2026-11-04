import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { CAMPAIGN_LINE } from '@/lib/wrapped/copy';
import { POLAROID, SHARE_HEIGHT, SHARE_WIDTH, wrappedArt } from '@/lib/wrapped/theme';

/**
 * lawexa.com/wrapped for someone without a Wrapped: a friend who tapped a
 * finalist's shared card, or a student whose Wrapped is not ready. It says
 * what Wrapped is and asks them to sign up to get theirs (Arthur's spec). A
 * share's `?r=CODE` is kept through sign-up by lib/utils/attribution.ts, so
 * the sharer is counted. The example card is marked as an example: it shows
 * no real student.
 */
export function WrappedLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="wr-landing">
      <div className="wr-landing-inner">
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ font: '900 1.1rem/1 var(--wr-display)', color: 'inherit', textDecoration: 'none' }}>
            Lawexa
          </Link>
          {signedIn ? null : (
            <Link href="/login" style={{ font: '700 0.95rem/1 var(--wr-body)', color: 'inherit' }}>
              Sign in
            </Link>
          )}
        </header>

        <section style={{ display: 'grid', gap: 40, alignItems: 'center', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
          <div style={{ display: 'grid', gap: 20 }}>
            <p style={{ font: '700 0.95rem/1 var(--wr-body)', color: 'var(--wr-ink)' }}>Lawexa Wrapped · Bar Finals 2026</p>
            <h1>
              Your Bar Finals year, <span className="wr-mark">in eight cards.</span>
            </h1>
            <p>
              Every finalist who studied on Lawexa gets their own story: the courses you married, the overnights you pulled, the cases you
              kept opening, and a card made to post on your status.
            </p>
            {signedIn ? (
              <p>Your Wrapped isn&rsquo;t ready on this account. The Wrapped for every Lawexa user arrives on 1 December.</p>
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
                  <Link className="wr-cta" href="/login">
                    I have an account
                  </Link>
                </>
              )}
            </div>
          </div>

          <ExampleCard />
        </section>

        <section style={{ display: 'grid', gap: 16 }}>
          <h2>What&rsquo;s inside</h2>
          <div className="wr-landing-cards">
            <div className="wr-landing-card">
              <strong>Your report slip</strong>
              <p>All five Bar Part II courses, each with its relationship status. Every one stamped DONE.</p>
            </div>
            <div className="wr-landing-card">
              <strong>Overnight certified</strong>
              <p>Your overnights, your latest log-off and your hours on Lawexa, in Ikorodu to VI trips.</p>
            </div>
            <div className="wr-landing-card">
              <strong>Your Bar Finals personality</strong>
              <p>Section Quoter, Overnight Scholar, Drafting Don or one of three more, from how you studied.</p>
            </div>
            <div className="wr-landing-card">
              <strong>A card to post</strong>
              <p>Your vibe, your face card and three stats, sized for WhatsApp Status and Instagram stories.</p>
            </div>
          </div>
        </section>

        <footer style={{ display: 'grid', gap: 8 }}>
          <p style={{ font: '900 clamp(1.4rem, 4vw, 2.2rem)/1.1 var(--wr-display)', color: 'var(--wr-ink)', maxWidth: 'none' }}>
            {CAMPAIGN_LINE.map((part, i) => (
              <span key={part} className="wr-nowrap">
                {part}
                {i < CAMPAIGN_LINE.length - 1 ? ' ' : null}
              </span>
            ))}
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            Only you see your Wrapped. Nothing posts unless you press Share, and your card shows your first name and last initial only.
          </p>
        </footer>
      </div>
    </main>
  );
}

/**
 * An example card, plainly labelled, built from Arthur's art for vibe 14 at the
 * manifest's places (the polaroid's window and prop strip, turned −3°), with
 * made-up words, so a visitor sees what they would get and no real student.
 */
const EXAMPLE_VIBE = 14;
const pct = (value: number, of: number) => `${(value / of) * 100}%`;

function ExampleCard() {
  const [wx, wy, ww, wh] = POLAROID.window;
  const [px, py, pw, ph] = POLAROID.prop;
  return (
    <figure style={{ justifySelf: 'center', width: 'min(100%, 340px)', margin: 0 }}>
      <div aria-hidden style={{ position: 'relative', aspectRatio: '9 / 16', containerType: 'size', border: '4px solid var(--wr-ink)', boxShadow: '10px 10px 0 var(--wr-ink)', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Arthur's static art, composed by position */}
        <img src={wrappedArt('frame', EXAMPLE_VIBE)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', inset: 0, transform: `rotate(${POLAROID.rotationDeg}deg)`, transformOrigin: `${pct(POLAROID.origin[0], SHARE_WIDTH)} ${pct(POLAROID.origin[1], SHARE_HEIGHT)}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Arthur's static art */}
          <img src={wrappedArt('face', EXAMPLE_VIBE)} alt="" style={{ position: 'absolute', left: pct(wx, SHARE_WIDTH), top: pct(wy, SHARE_HEIGHT), width: pct(ww, SHARE_WIDTH), height: pct(wh, SHARE_HEIGHT) }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- Arthur's static art */}
          <img src={wrappedArt('prop', EXAMPLE_VIBE)} alt="" style={{ position: 'absolute', left: pct(px, SHARE_WIDTH), top: pct(py, SHARE_HEIGHT), width: pct(pw, SHARE_WIDTH), height: pct(ph, SHARE_HEIGHT) }} />
        </div>
        <p style={{ position: 'absolute', left: '7.8%', top: '16.5%', font: '700 2.6cqw/1 var(--wr-body)', letterSpacing: '0.8cqw' }}>MY POST-BAR FINALS VIBE:</p>
        <p style={{ position: 'absolute', left: '7.8%', top: '19.5%', font: '900 8.8cqw/0.95 var(--wr-display)', letterSpacing: '-0.2cqw' }}>Esq. loading…</p>
        <p style={{ position: 'absolute', left: '7.8%', top: '72%', display: 'grid', gap: '1.4cqw', font: '700 3.4cqw/1 var(--wr-body)' }}>
          {['14 overnights', '412 judgments read', '21 day streak'].map((text) => (
            <span key={text} style={{ background: 'var(--wr-white)', border: '0.4cqw solid var(--wr-ink)', padding: '2cqw 2.4cqw' }}>
              {text}
            </span>
          ))}
        </p>
        <p style={{ position: 'absolute', left: '17%', top: '93.6%', font: '700 3.1cqw/1 var(--wr-body)', letterSpacing: '0.2cqw' }}>GET YOURS · LAWEXA.COM/WRAPPED</p>
      </div>
      <figcaption style={{ marginTop: 18, textAlign: 'center', font: '500 0.85rem/1.4 var(--wr-body)', color: 'var(--wr-ink-muted)' }}>
        An example card, with made-up numbers.
      </figcaption>
    </figure>
  );
}
