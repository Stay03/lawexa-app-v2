'use client';

import { Boxes, Briefcase, GraduationCap, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import type { SpaceFilter } from '../model';

/**
 * The `/spaces` list states — the three-state contract every v2 query region
 * owns (standards §8iv: skeleton ≠ empty ≠ error, and every state offers a way
 * onward). Rendered through the collab feature's `CollabMessage`, so the door
 * panels, the channel refusals and these read as one family.
 *
 * `still` follows the house rule: a ROUTE fallback reserves the shape WITHOUT
 * a pulse (it waits on an RSC payload, not a request); the live screen's
 * `isPending` region pulses, because a pulse promises a request is in flight.
 * Phase-5 W4, 2026-08-04.
 */

/**
 * One skeleton row at {@link import('./SpaceRow').SpaceRow}'s EXACT geometry —
 * same `gap-3 px-2 py-3`, same `size-9` tile with its `mt-0.5`, same two text
 * lines — so the tile, the name and the meta land on the pixels the real row
 * will use and nothing reflows at the hand-off.
 *
 * TWO TEXT LINES IS THE ROW'S MEDIAN, not its maximum: a description is
 * optional and most rows have none, so reserving for three would defend
 * against a settle that rarely happens while making the common one worse
 * (standards §8iv).
 */
function SpaceRowSkeleton({ still }: { still: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-3 px-2 py-3">
      <Skeleton className={cn('mt-0.5 size-9 shrink-0 rounded-lg', bar)} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className={cn('h-4 w-2/5 rounded', bar)} />
        <div className="flex items-center gap-2">
          <Skeleton className={cn('h-3 w-1/3 rounded', bar)} />
          <Skeleton className={cn('ml-auto h-3 w-16 shrink-0 rounded', bar)} />
        </div>
      </div>
    </div>
  );
}

/** The initial-load skeleton — five rows with progressive opacity down the
 *  stack, the shared v2 list fade, so moving between library surfaces and this
 *  one is ONE loading language. */
export function SpacesListSkeleton({
  rows = 5,
  still = false,
}: {
  rows?: number;
  still?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}>
          <SpaceRowSkeleton still={still} />
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
 * The designed empty state — it TEACHES what a space is and it ACTS (DIRECTION
 * 13; never a blank pane). The primary action opens the create dialog rather
 * than navigating, so the reader stays exactly where they are.
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
    <CollabMessage
      icon={copy.icon}
      tone="accent"
      title={copy.title}
      description={copy.description}
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
      footnote={
        filter === 'all'
          ? 'Invited already? Open Invitations to accept.'
          : undefined
      }
    />
  );
}

/**
 * Error state — visually distinct from empty, with a real retry. `message`
 * carries the SERVER's own explanation when it gave one (a 4xx refusal); the
 * designed sentence is kept for the cases where there is genuinely nothing to
 * relay (5xx, network).
 */
export function SpacesErrorState({
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
      title="Couldn't load your spaces"
      description={
        message?.trim() ||
        'Something went wrong while loading your spaces. Please try again.'
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
