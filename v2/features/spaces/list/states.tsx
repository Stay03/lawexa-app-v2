'use client';

import Link from 'next/link';
import { Boxes, Briefcase, GraduationCap } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { CrestSkeleton } from '@/v2/features/collab/kit/Crest';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { SpaceFilter } from '../model';

/**
 * The `/spaces` list states — the three-state contract every v2 query region
 * owns (standards §8iv: skeleton ≠ empty ≠ error, and every state offers a way
 * onward), now split so that the two the reader must tell apart fastest do not
 * look the same: emptiness gets the room, failure gets a strip.
 *
 * `still` follows the house rule: a ROUTE fallback reserves the shape WITHOUT
 * a pulse (it waits on an RSC payload, not a request); the live screen's
 * `isPending` region pulses, because a pulse promises a request is in flight.
 */

/**
 * One skeleton lane at {@link import('./SpaceRow').SpaceRow}'s EXACT geometry:
 * the same `min-h-20` bordered box, the same `gap-3.5` and `px-3 py-3`, the
 * same 48px crest, and the same two text lines with a right-anchored trail.
 * Nothing reflows at the hand-off.
 *
 * The lane's height no longer swings, because the description left it — so
 * unlike the old row, this skeleton reserves the row's ACTUAL height rather
 * than its median.
 */
function SpaceLaneSkeleton({ still }: { still: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex min-h-20 items-center gap-3.5 rounded-xl border border-border px-3 py-3">
      <CrestSkeleton size="lg" still={still} />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className={cn('h-4 w-2/5 rounded', bar)} />
        <div className="flex items-center gap-2">
          <Skeleton className={cn('h-4 w-16 shrink-0 rounded', bar)} />
          <Skeleton className={cn('h-4 w-20 shrink-0 rounded', bar)} />
          <Skeleton className={cn('ml-auto h-4 w-24 shrink-0 rounded', bar)} />
        </div>
      </div>
    </div>
  );
}

/** The initial-load skeleton — gap-separated lanes with progressive opacity
 *  down the stack, the shared v2 list fade. */
export function SpacesListSkeleton({
  rows = 5,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <SpaceLaneSkeleton still={still} />
        </div>
      ))}
    </div>
  );
}

/** The ghost the empty state carries — two silent lanes at the real geometry,
 *  so "create your first space" shows the shape it is about to make instead of
 *  only describing it. Not a skeleton: it never pulses, because nothing is
 *  loading. */
function SpaceLaneGhost() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex min-h-20 items-center gap-3.5 rounded-xl border border-border px-3 py-3"
        >
          <div className="size-12 shrink-0 rounded-xl bg-secondary" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-4 w-2/5 rounded bg-secondary" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 shrink-0 rounded bg-secondary/70" />
              <div className="h-4 w-20 shrink-0 rounded bg-secondary/70" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Per-tab empty copy — one entry per tab, so no tab can fall through to a
 *  sentence that names the wrong thing. */
const EMPTY_COPY: Record<
  SpaceFilter,
  { icon: typeof Boxes; title: string; description: string }
> = {
  all: {
    icon: Boxes,
    title: 'Create your first space',
    description:
      'A space is a shared workroom — channels for messages, task lists, files, and Lawexa on call. Start one for your team or your study group, or accept an invitation to join someone else’s.',
  },
  work: {
    icon: Briefcase,
    title: 'No work spaces yet',
    description:
      'Work spaces are for a firm, a team or a matter. Create one, or switch to All to see everything you belong to.',
  },
  study: {
    icon: GraduationCap,
    title: 'No study spaces yet',
    description:
      'Study spaces are for a course, a reading group or exam prep. Create one, or switch to All to see everything you belong to.',
  },
};

/**
 * The designed empty state — it TEACHES what a space is, SHOWS the lane it is
 * about to make, and ACTS (DIRECTION 13; never a blank pane). The primary
 * action opens the create dialog rather than navigating, so the reader stays
 * exactly where they are.
 */
export function SpacesEmptyState({
  filter,
  onCreate,
  onShowAll,
}: {
  filter: SpaceFilter;
  onCreate: () => void;
  /** Offered on a filtered tab only — the way back to the whole collection. */
  onShowAll?: () => void;
}) {
  const copy = EMPTY_COPY[filter];
  return (
    <CollabEmpty
      icon={copy.icon}
      tone="accent"
      title={copy.title}
      description={copy.description}
      ghost={<SpaceLaneGhost />}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={onCreate}>
            {filter === 'all' ? 'Create a space' : `Create a ${filter} space`}
          </Button>
          {onShowAll ? (
            <Button variant="ghost" size="sm" onClick={onShowAll}>
              View all spaces
            </Button>
          ) : null}
        </div>
      }
      // A REAL LINK, because the pill it used to name is conditional: with no
      // pending invitation there is no Invitations control anywhere on this
      // screen, and a footnote pointing at a control that does not exist is
      // worse than no footnote.
      footnote={
        filter === 'all' ? (
          <>
            Invited already?{' '}
            <Link
              href="/invitations"
              className={cn(
                'v2-interactive rounded-sm font-medium text-foreground underline underline-offset-2 hover:text-primary',
                FOCUS_RING,
              )}
            >
              Check your invitations
            </Link>
            .
          </>
        ) : undefined
      }
    />
  );
}

/**
 * Load failure. A PANEL, because this renders only when `spaces.length === 0`:
 * the screen is otherwise blank, so there is nothing for a panel to hide and
 * nothing else to read (`CollabFailure`'s docblock holds the rule). The
 * refresh-failed-over-cached-rows case in `SpacesBrowser` is the strip.
 *
 * `message` carries the SERVER's own explanation when it gave one (a 4xx
 * refusal); the designed sentence is kept for the cases where there is
 * genuinely nothing to relay (5xx, network).
 */
export function SpacesErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <CollabFailure
      presentation="panel"
      title="Couldn’t load your spaces"
      message={
        message?.trim() ||
        'Something went wrong while loading your spaces. Please try again.'
      }
      onRetry={onRetry}
    />
  );
}
