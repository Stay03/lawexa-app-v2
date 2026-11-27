'use client';

import { Lock } from 'lucide-react';

import { AccountOfferButtons } from '@/v2/shell/AccountOfferButtons';

/** The offer's DOM id: the locked Export button scrolls here. */
export const NOTE_LOCK_ID = 'note-lock-offer';

/**
 * Where a guest's cut of someone else's note ends (server guest-locks, 27
 * November 2026): the cut fades into this, inline under a thin rule, the
 * case page's grammar. Every signed-in reader gets the whole note, so the way
 * on is an account or signing in.
 */
export function NoteLockOffer() {
  return (
    <section
      id={NOTE_LOCK_ID}
      aria-label="Read the rest of this note"
      className="flex scroll-mt-6 flex-col items-start gap-3 border-t border-border/60 pt-5 font-sans"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <Lock className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Sign in to read the rest</p>
        <p className="max-w-md text-sm text-muted-foreground">
          The full note comes with a free Lawexa account.
        </p>
      </div>
      <AccountOfferButtons />
    </section>
  );
}
