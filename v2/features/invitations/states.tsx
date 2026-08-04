'use client';

import Link from 'next/link';
import { MailOpen, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';

/**
 * The `/invitations` states. Same three-state contract and the same `still`
 * rule as every other v2 list surface. Phase-5 W4, study A7 — 2026-08-04.
 */

/** One skeleton row at `InvitationRow`'s exact geometry — tile, title, meta,
 *  and the two action buttons reserved on the right so nothing shifts when the
 *  real pair arrives. */
function InvitationRowSkeleton({ still }: { still: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Skeleton className={cn('mt-0.5 size-9 shrink-0 rounded-lg', bar)} />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className={cn('h-4 w-2/5 rounded', bar)} />
          <Skeleton className={cn('h-3 w-3/5 rounded', bar)} />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 pl-12 sm:pl-0">
        <Skeleton className={cn('h-8 w-20 rounded-md', bar)} />
        <Skeleton className={cn('h-8 w-20 rounded-md', bar)} />
      </div>
    </div>
  );
}

/** The initial-load skeleton — three rows under one section heading bar, which
 *  is the median inbox (most people have one or two invitations, never ten). */
export function InvitationsSkeleton({
  rows = 3,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div aria-hidden className="flex flex-col">
      <Skeleton className={cn('mb-2 h-3 w-24 rounded', bar)} />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.2) }}>
          <InvitationRowSkeleton still={still} />
        </div>
      ))}
    </div>
  );
}

/**
 * The designed empty inbox — it says the true thing (nothing is waiting) and
 * it says what to do about it, in the tone the brief asks for: an invitation
 * is something another person sends you, so the way onward is to ask them.
 */
export function InvitationsEmptyState() {
  return (
    <CollabMessage
      icon={MailOpen}
      tone="neutral"
      title="No invitations"
      description="Nothing is waiting for you. Ask a colleague to invite you to their organization, space or channel — it lands here the moment they do."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/spaces">Back to your spaces</Link>
        </Button>
      }
      footnote="You can also start a space of your own."
    />
  );
}

/**
 * All three inboxes failed. A partial failure is NOT this state — one inbox
 * failing leaves the other two rendered, with a quiet line saying that some
 * invitations couldn't be loaded (see `InvitationsScreen`).
 */
export function InvitationsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabMessage
      icon={WifiOff}
      tone="alert"
      title="Couldn't load your invitations"
      description="Something went wrong while checking for invitations. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
