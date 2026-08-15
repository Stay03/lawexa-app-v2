'use client';

import Link from 'next/link';
import { Hash, MessagesSquare, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { CrestSkeleton } from '@/v2/features/collab/kit/Crest';
import type { MyChannelsLens } from './model';

/**
 * The `/channels` states. Three of them, each designed as itself (the split
 * `CollabEmpty` / `CollabFailure` replaced the one-size panel that made "you
 * have no channels" and "the network died" look identical):
 *
 *  - SKELETON at the row's real geometry — crest, title line, meta line,
 *    right-anchored trail — so nothing moves at the swap. It pulses in the
 *    route fallback as well as on the live screen: one wait, one appearance,
 *    with no seam where the route hands over to the query.
 *  - EMPTY teaches where channels come from and offers the way there, with a
 *    ghost of the populated list above it so the reader sees the shape they
 *    are about to make.
 *  - NO MATCHES is a THIRD state, not the empty one: a reader who filtered to
 *    Unread and found nothing has not lost their channels, and telling them to
 *    go make a space would be answering a question they did not ask.
 */

/** One skeleton row at `MyChannelRow`'s exact geometry. */
function MyChannelRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-2 py-3">
      <CrestSkeleton size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-1/3 rounded" />
        </div>
        <Skeleton className="h-3 w-3/5 rounded" />
      </div>
      <Skeleton className="mt-1 h-3 w-8 shrink-0 rounded" />
    </div>
  );
}

/**
 * The list's reserved shape. It reproduces the REAL structure the screen
 * renders — `gap-5` sections, each led by an 11px uppercase recency heading —
 * rather than a flat run of rows: a flat skeleton under a sectioned list drops
 * the whole column by a heading plus a gap per group at the swap, which on a
 * three-group list is most of a row's height. Two groups is the honest average
 * for a triage list (something today, the rest older).
 */
const SKELETON_GROUPS: readonly number[] = [3, 3];

export function MyChannelsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      {SKELETON_GROUPS.map((rows, group) => {
        // Derived, not accumulated in a mutable counter: nothing in render may
        // depend on the order React calls it in.
        const offset = SKELETON_GROUPS.slice(0, group).reduce(
          (total, count) => total + count,
          0,
        );
        return (
          <div key={group}>
            <div className="px-2 pb-1">
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <div className="flex flex-col">
              {Array.from({ length: rows }).map((_, index) => (
                <div
                  key={index}
                  style={{ opacity: Math.max(0.25, 1 - (offset + index) * 0.14) }}
                >
                  <MyChannelRowSkeleton />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A silent impression of two populated rows — the ghost above the empty copy. */
function MyChannelsGhost() {
  return (
    <div className="flex flex-col gap-1">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-start gap-3 px-2 py-3">
          <span className="mt-0.5 size-9 shrink-0 rounded-lg bg-secondary" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-1.5">
              <Hash className="size-3.5 text-muted-foreground/50" />
              <span className="h-3.5 w-24 rounded bg-secondary" />
            </div>
            <span className="block h-3 w-40 max-w-full rounded bg-secondary/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The designed empty state — teaches where channels come from, and acts. */
export function MyChannelsEmptyState() {
  return (
    <CollabEmpty
      icon={MessagesSquare}
      tone="accent"
      title="No channels yet"
      description="Channels live inside spaces. Join or create a space, and every channel you belong to shows up here — newest activity first."
      ghost={<MyChannelsGhost />}
      action={
        <Button asChild size="sm">
          <Link href="/spaces">Go to your spaces</Link>
        </Button>
      }
      footnote="Invited already? Open Invitations to accept."
    />
  );
}

const NO_MATCH_COPY: Record<MyChannelsLens, { title: string; description: string }> = {
  all: {
    title: 'No channels match',
    description: 'Nothing here answers to that search. Try fewer words, or the name of the space it lives in.',
  },
  unread: {
    title: "You're all caught up",
    description: 'Nothing is unread in any of your channels right now.',
  },
  mentions: {
    title: 'No mentions waiting',
    description: 'Nobody has @mentioned you in a channel you belong to.',
  },
};

/**
 * The list is fine — this LENS is empty. Offers the way back to the whole
 * list, which is the only action that can help here.
 */
export function MyChannelsNoMatchState({
  lens,
  searching,
  onReset,
}: {
  lens: MyChannelsLens;
  /** A search term narrowed it, whatever the lens says. */
  searching: boolean;
  onReset: () => void;
}) {
  const copy = searching ? NO_MATCH_COPY.all : NO_MATCH_COPY[lens];
  return (
    <CollabEmpty
      icon={SearchX}
      title={copy.title}
      description={copy.description}
      action={
        <Button variant="outline" size="sm" onClick={onReset}>
          Show all channels
        </Button>
      }
    />
  );
}

/** The load failed and there is nothing cached to keep on screen. */
export function MyChannelsErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <CollabFailure
      presentation="panel"
      title="Couldn't load your channels"
      message={
        message?.trim() ||
        'Something went wrong while loading your channels. Please try again.'
      }
      onRetry={onRetry}
    />
  );
}
