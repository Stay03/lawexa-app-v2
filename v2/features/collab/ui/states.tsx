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
      description="Shared spaces for your team or study group: conversations, folders and files. Sign in to pick up where your group left off."
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
      description="Shared spaces for teams and study groups: conversations, folders and files. Create an account to join one or start your own."
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

/**
 * TEAM CHANNELS ARE CLOSED TO THIS ACCOUNT — a signed-in, eligible reader below
 * researcher at a `/channels/*` or discover URL (Stay, 11 October 2026: Team
 * Channels for researchers and above). Not an error and not a dead end: their
 * own Spaces are one tap away, and an old link from a notification lands here
 * rather than on a refused request.
 */
export function TeamChannelsClosedState() {
  return (
    <CollabMessage
      icon={MessagesSquare}
      title="Team Channels are for researchers"
      description="Channels and threads belong to Lawexa's research team. Your Spaces hold your chats, folders and files, and you can invite people into them."
      action={
        <Button asChild size="sm">
          <Link href="/spaces">Go to your Spaces</Link>
        </Button>
      }
    />
  );
}
