import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { CAMPAIGN_LINE } from '@/lib/wrapped/copy';

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
          <Link href="/" style={{ font: '800 1.1rem/1 var(--wr-display)', color: 'inherit', textDecoration: 'none' }}>
            Lawexa
          </Link>
          {signedIn ? null : (
            <Link href="/login" style={{ font: '600 0.95rem/1 var(--wr-body)', color: 'inherit' }}>
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
          <p style={{ font: '800 clamp(1.4rem, 4vw, 2.2rem)/1.1 var(--wr-display)', color: 'var(--wr-ink)', maxWidth: 'none' }}>
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

/** A made-up card, plainly labelled, so a visitor sees what they would get. */
function ExampleCard() {
  return (
    <figure style={{ justifySelf: 'center', width: 'min(100%, 340px)', margin: 0 }}>
      <div
        aria-hidden
        style={{
          aspectRatio: '9 / 16',
          borderRadius: 24,
          background: 'var(--wr-lilac)',
          border: '3px solid var(--wr-ink)',
          padding: '9%',
          display: 'flex',
          flexDirection: 'column',
          gap: '5%',
          containerType: 'size',
          transform: 'rotate(2deg)',
          boxShadow: '10px 12px 0 var(--wr-ink)',
        }}
      >
        <p style={{ font: '600 4cqw/1.2 var(--wr-body)' }}>My post-Bar Finals vibe:</p>
        <p style={{ font: '800 10cqw/1.04 var(--wr-display)', letterSpacing: '-0.02em' }}>Esq. loading…</p>
        <div style={{ flex: 1, borderRadius: 18, background: 'var(--wr-cream)', border: '3px solid var(--wr-ink)', display: 'grid', placeItems: 'center' }}>
          <span style={{ font: '800 26cqw/1 var(--wr-display)' }}>A</span>
        </div>
        <div style={{ display: 'flex', gap: '3%', flexWrap: 'wrap' }}>
          {['14 overnights', '412 judgments', '21-day streak'].map((text) => (
            <span key={text} style={{ font: '700 3.6cqw/1 var(--wr-body)', background: 'var(--wr-cream)', border: '2px solid var(--wr-ink)', borderRadius: 999, padding: '2.4cqw 3.4cqw' }}>
              {text}
            </span>
          ))}
        </div>
        <span style={{ alignSelf: 'flex-start', font: '800 4.4cqw/1 var(--wr-display)', background: 'var(--wr-ink)', color: 'var(--wr-gold)', borderRadius: 999, padding: '3cqw 4cqw' }}>
          The Section Quoter
        </span>
        <p style={{ font: '600 3.4cqw/1 var(--wr-body)' }}>Get yours · lawexa.com/wrapped</p>
      </div>
      <figcaption style={{ marginTop: 18, textAlign: 'center', font: '600 0.85rem/1.4 var(--wr-body)', color: 'var(--wr-ink-soft)' }}>
        An example card, with made-up numbers.
      </figcaption>
    </figure>
  );
}
