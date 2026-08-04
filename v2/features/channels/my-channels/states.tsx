'use client';

import Link from 'next/link';
import { MessagesSquare, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';

/**
 * The `/channels` index states. Same three-state contract and the same `still`
 * rule as every other v2 list surface; the empty state points at `/spaces`,
 * because a channel cannot exist outside one — an index with no rows is not a
 * dead end, it is a signpost. Phase-5 W4, owner decision D6 — 2026-08-04.
 */

/** One skeleton row at `MyChannelRow`'s exact geometry — tile, name line,
 *  preview line, right-anchored trail. */
function MyChannelRowSkeleton({ still }: { still: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-3 px-2 py-3">
      <Skeleton className={cn('mt-0.5 size-9 shrink-0 rounded-lg', bar)} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className={cn('h-4 w-1/3 rounded', bar)} />
          <Skeleton className={cn('h-3 w-16 rounded', bar)} />
        </div>
        <Skeleton className={cn('h-3 w-3/5 rounded', bar)} />
      </div>
      <Skeleton className={cn('mt-1 h-3 w-8 shrink-0 rounded', bar)} />
    </div>
  );
}

export function MyChannelsSkeleton({
  rows = 6,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.14) }}>
          <MyChannelRowSkeleton still={still} />
        </div>
      ))}
    </div>
  );
}

/** The designed empty state — teaches where channels come from and acts. */
export function MyChannelsEmptyState() {
  return (
    <CollabMessage
      icon={MessagesSquare}
      tone="accent"
      title="No channels yet"
      description="Channels live inside spaces. Join or create a space, and every channel you belong to shows up here — newest activity first."
      action={
        <Button asChild size="sm">
          <Link href="/spaces">Go to your spaces</Link>
        </Button>
      }
      footnote="Invited already? Open Invitations to accept."
    />
  );
}

export function MyChannelsErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <CollabMessage
      icon={WifiOff}
      tone="alert"
      title="Couldn't load your channels"
      description={
        message?.trim() ||
        'Something went wrong while loading your channels. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
