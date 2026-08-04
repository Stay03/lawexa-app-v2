'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MailWarning } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CollabMessage } from './CollabMessage';

/**
 * CollabVerifyEmailState — the ONE server-side gate on collab, as a designed
 * panel (the quiz `VerifyEmailState` pattern, applied to Spaces — study A0
 * "BUILD NEW"; phase-5 W1, 2026-08-04). The backend gates collab on
 * membership + VERIFIED EMAIL, so an unverified registered account 403s on
 * every collab endpoint; the gate renders this from the session snapshot on
 * the first frame, with every collab query held at `enabled: false` so no
 * doomed request is ever sent.
 *
 * WHY IT CARRIES A REFRESH BUTTON: the snapshot is resolved once per full
 * page load (`app/v2/layout.tsx`), and a layout does not re-render on a soft
 * navigation — so a user who verifies in another tab would stay locked out
 * until a hard reload with nothing suggesting one. `router.refresh()` re-runs
 * the server layout, republishes the snapshot, and the panel disappears if
 * the address really is verified; if not, it honestly stays — hence "check
 * again", promising nothing.
 *
 * Deliberately NO "resend" action: v2 does not own the verification flow, and
 * a button that only looks like it resends is worse than the truth about
 * where the link is.
 */
export function CollabVerifyEmailState() {
  const router = useRouter();
  // Purely presentational: `router.refresh()` returns nothing to await, so the
  // spinner is a fixed beat acknowledging the press; it clears on its own if
  // nothing changed, so the button can never latch.
  const [checking, setChecking] = useState(false);

  const recheck = () => {
    setChecking(true);
    router.refresh();
    window.setTimeout(() => setChecking(false), 1200);
  };

  return (
    <CollabMessage
      icon={MailWarning}
      tone="alert"
      title="Verify your email to open Spaces"
      description="Spaces need a verified email address — your messages reach real teammates. Check your inbox for the verification link we sent when you signed up."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={recheck} disabled={checking}>
            {checking ? <Loader2 aria-hidden className="animate-spin" /> : null}
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
