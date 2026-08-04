import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CollabMessage } from './CollabMessage';

/**
 * states — the two audience refusals the `CollabAccessGate` renders. Both are
 * DESIGNED STATES with a way onward, never redirects (study A0: v1's
 * `SpacesGuard` `router.replace('/')` is DROPPED; the quiz gate is the
 * pattern). The verify-email panel lives in its own `'use client'` module
 * (`VerifyEmailState.tsx`) because it needs `useRouter` for its re-check
 * affordance — same split, same reason as the quiz feature.
 *
 * Audience per owner decision D1 (2026-08-04): every registered account;
 * guests and bots excluded. Honest about the boundary: the backend does not
 * block guest tokens (study §1 item 6; the server-side block is the
 * coordinator's backend ask), so the copy describes a product boundary and
 * promises nothing about security.
 */

/** Signed out — the queries are gated off, so this replaces a 401 screen. */
export function CollabSignedOutState() {
  return (
    <CollabMessage
      icon={MessagesSquare}
      tone="accent"
      title="Sign in to open Spaces"
      description="Spaces are shared workrooms for your team or study group — channels for messages, task lists, files, and Lawexa on call. Sign in to pick up where your group left off."
      action={
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      }
    />
  );
}

/**
 * CREATE AN ACCOUNT — what a GUEST sees at any `/spaces/*` or `/channels/*`
 * URL. A guest is a view-only pre-registration identity, so the honest answer
 * is a registration nudge: registering IS the door (D1).
 */
export function CollabCreateAccountState() {
  return (
    <CollabMessage
      icon={MessagesSquare}
      tone="accent"
      title="Create a free account to join Spaces"
      description="Spaces are shared workrooms for teams and study groups — channels, task lists, files, and Lawexa on call. They belong to the registered experience: create an account to join or start one."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/register">Create free account</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      }
      footnote="Everything you can already browse stays free to browse."
    />
  );
}
