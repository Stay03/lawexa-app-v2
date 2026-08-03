'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MailWarning } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { QuizMessage } from './QuizMessage';

/**
 * VerifyEmailState — the ONE server-side gate on the player, as a designed
 * panel.
 *
 * Every `/quizzes/*` endpoint 403s for a REGISTERED account whose email is not
 * verified (verified live, 2026-08-03). Two paths reach this panel and they
 * must look identical:
 *  - the session SNAPSHOT already says so, so it renders on the first frame;
 *  - a request came back 403 anyway, because the snapshot was stale.
 *
 * ── WHY IT CARRIES A REFRESH BUTTON ─────────────────────────────────────────
 * The snapshot is resolved ONCE per full page load, in `app/v2/layout.tsx`, and
 * a layout does not re-render on a soft navigation. So a user who verifies in
 * another tab mid-visit stays locked out of every quiz surface until they
 * happen to hard-reload — with nothing on screen suggesting they should. That
 * is a dead end, and the panel is the only place that can offer the way out.
 *
 * `router.refresh()` re-runs the server layout, which re-runs `verifySession()`
 * and republishes the snapshot; if the address really is verified the panel
 * disappears and the screen behind it renders. If it is NOT verified yet, the
 * refresh completes and the panel simply stays — which is the honest answer, so
 * the button says "Check again" rather than promising anything.
 *
 * There is deliberately NO "resend" action: v2 does not own the verification
 * flow, and a button that only LOOKS like it resends is worse than a sentence
 * that tells the truth about where the link is.
 */
export function VerifyEmailState() {
  const router = useRouter();
  // Purely presentational: `router.refresh()` gives no promise to await, so the
  // spinner is a fixed beat that acknowledges the press. It clears when the
  // refresh re-renders this tree — or on its own if nothing changed, so the
  // button can never latch.
  const [checking, setChecking] = useState(false);

  const recheck = () => {
    setChecking(true);
    router.refresh();
    window.setTimeout(() => setChecking(false), 1200);
  };

  return (
    <QuizMessage
      icon={MailWarning}
      tone="alert"
      title="Verify your email to practise"
      description="Quiz practice needs a verified email address. Check your inbox for the verification link we sent when you signed up."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={recheck} disabled={checking}>
            {checking ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            I&apos;ve verified — check again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">Go to settings</Link>
          </Button>
        </div>
      }
      footnote="Everything else in Lawexa keeps working while you verify."
    />
  );
}
