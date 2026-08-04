'use client';

import Link from 'next/link';
import { Hash, Lock, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { LIST_COLUMN } from '@/v2/shell/page-columns';

/**
 * The `/spaces/[spaceId]` states — the loading silhouettes and the designed
 * refusals, shared by the LIVE screen and the route fallback
 * (`app/v2/spaces/[spaceId]/loading.tsx` imports {@link SpaceScreenFrame}), so
 * the two shapes can never drift.
 *
 * `still` is the house rule: a route fallback reserves the shape WITHOUT a
 * pulse (nothing is in flight behind it — it waits on an RSC payload); the
 * live screen's `isPending` regions pulse because a request really is out.
 * Phase-5 W4, 2026-08-04.
 */

/** One channel-row skeleton at `SpaceChannelRow`'s exact geometry — the 18px
 *  glyph, the two text lines, the right-anchored trail. */
function ChannelRowSkeleton({ still }: { still: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-3 px-2 py-3">
      <Skeleton className={cn('mt-0.5 size-[18px] shrink-0 rounded', bar)} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className={cn('h-4 w-1/3 rounded', bar)} />
        <div className="flex items-center gap-2">
          <Skeleton className={cn('h-3 w-2/5 rounded', bar)} />
          <Skeleton className={cn('ml-auto h-3 w-16 shrink-0 rounded', bar)} />
        </div>
      </div>
      <Skeleton className={cn('mt-1 h-3 w-8 shrink-0 rounded', bar)} />
    </div>
  );
}

/** The channel list's pending shape — four rows, progressive opacity. */
export function ChannelListSkeleton({
  rows = 4,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.18) }}>
          <ChannelRowSkeleton still={still} />
        </div>
      ))}
    </div>
  );
}

/**
 * The whole space screen's silhouette — identity header (kicker, name,
 * description), the section heading, then the channel rows. Geometry mirrors
 * `SpaceScreen` exactly, so the hand-off is content resolving rather than a
 * layout swap.
 */
export function SpaceScreenFrame({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className={LIST_COLUMN}>
      <div className="flex items-start gap-3">
        <Skeleton className={cn('size-11 shrink-0 rounded-xl', bar)} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className={cn('h-3 w-48 rounded', bar)} />
          <Skeleton className={cn('h-7 w-2/5 rounded', bar)} />
          <Skeleton className={cn('h-3.5 w-3/5 rounded', bar)} />
        </div>
      </div>

      <div className="mt-5 border-t pt-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <Skeleton className={cn('h-4 w-24 rounded', bar)} />
          <Skeleton className={cn('h-8 w-28 rounded-md', bar)} />
        </div>
        <ChannelListSkeleton still={still} />
      </div>
    </div>
  );
}

/** 403 / 404 — a POLICY refusal, never auto-mapped to verify-email (the
 *  collab model's rule: on collab endpoints a 403 usually means "not a
 *  member"). */
export function SpaceAccessDeniedState() {
  return (
    <CollabMessage
      icon={Lock}
      tone="neutral"
      title="You're not in this space"
      description="Spaces are private to their members. Ask an owner or admin to invite you, then it appears in your list."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/spaces">Back to your spaces</Link>
        </Button>
      }
    />
  );
}

/** Space detail load failure — distinct from the refusal above, with a retry. */
export function SpaceErrorState({
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
      title="Couldn't load this space"
      description={
        message?.trim() || 'Something went wrong on our side. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** The channel list failed while the space itself loaded — a section-scoped
 *  error, so the identity header above it stays on screen. */
export function ChannelsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabMessage
      icon={WifiOff}
      tone="alert"
      title="Couldn't load channels"
      description="We couldn't load this space's channels. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/**
 * The designed empty channel list — it teaches what a channel is for and,
 * for someone who can make one, it acts (DIRECTION 13). A member who cannot
 * create channels gets the honest sentence instead of a button that would
 * 403.
 */
export function ChannelsEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <CollabMessage
      icon={Hash}
      tone="neutral"
      title="No channels yet"
      description={
        canCreate
          ? 'Channels split a space by topic — one for the matter, one for admin, one for anything else. Create the first one and the conversation starts there.'
          : 'Channels in this space will show up here once an owner or admin creates one.'
      }
      action={
        canCreate ? (
          <Button size="sm" onClick={onCreate}>
            Create the first channel
          </Button>
        ) : undefined
      }
    />
  );
}
