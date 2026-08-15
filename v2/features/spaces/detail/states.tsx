'use client';

import Link from 'next/link';
import { Hash, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SpaceType } from '@/types/collab';
import { CrestSkeleton, SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import {
  LobbyFactsSkeleton,
  LobbyPeopleSkeleton,
  SPACE_LOBBY_COLUMN,
  SPACE_LOBBY_GRID,
} from './lobby-parts';

/**
 * The `/spaces/[spaceId]` states — the loading silhouettes and the designed
 * refusals, shared by the LIVE lobby and the route fallback
 * (`app/v2/(collab)/spaces/[spaceId]/loading.tsx` imports
 * {@link SpaceScreenFrame}), so the two shapes can never drift.
 *
 * `still` is the house rule: a route fallback reserves the shape WITHOUT a
 * pulse (nothing is in flight behind it — it waits on an RSC payload); the
 * live screen's `isPending` regions pulse.
 *
 * ── THE FALLBACK DRAWS THE PANE, NOT THE PAGE ──────────────────────────────
 * The rail is rendered by the `(collab)` layout, and `loading.tsx` wraps the
 * PAGE only — Next's Suspense boundary never covers the layout above it. So
 * this silhouette is the lobby alone, and the rail stays interactive beside it
 * throughout. That is the whole point of the frame: a channel switch repaints
 * the pane, never the place.
 */

/** One channel-row skeleton at {@link SpaceChannelRow}'s exact geometry — the
 *  36px tile, the two text lines, the right-anchored age. */
function ChannelRowSkeleton({ still }: { still: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <Skeleton className={cn('mt-0.5 size-9 shrink-0 rounded-lg', bar)} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className={cn('h-4 w-1/3 rounded', bar)} />
        <Skeleton className={cn('h-3 w-3/5 rounded', bar)} />
      </div>
      <Skeleton className={cn('mt-1 h-3 w-8 shrink-0 rounded', bar)} />
    </div>
  );
}

/** The activity digest's pending shape — rows at the real geometry, with the
 *  house progressive-opacity fade. */
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
 * What the frame may print before the space detail lands — every field of it
 * carried by the row in the spaces list, and not one of them a permission.
 */
export interface SpaceFrameIdentity {
  uuid: string;
  name: string;
  type: SpaceType;
  /** "Work" / "Study" — the kicker's first fact. */
  typeLabel: string;
  /** `spaceOwnerLabel` of the row: the organisation, or "Personal". */
  ownerLabel: string;
  isPrivate: boolean;
  /** The row's own description, or `null`. NOT "not yet loaded" — a space with
   *  no description prints nothing here, and so does this. */
  description: string | null;
}

/**
 * The whole lobby's silhouette — the identity block (crest, kicker, name,
 * description, presence + primary action), the activity digest, and the two
 * side regions. Geometry mirrors the live lobby, so the hand-off is content
 * resolving rather than a layout swap.
 *
 * ── AND IT TAKES THE IDENTITY THE LIST ALREADY HAD ─────────────────────────
 * Owner, 15 August 2026: "for spaces the first skeleton is a full skeleton, the
 * second one has some text and images and stuff". Two loading states that do
 * not look alike read as two pages, not one page arriving. The row the reader
 * tapped carries the crest, the kicker, the name, whether it is private and its
 * description — so with `identity` supplied the first state IS the second one,
 * and only the channel digest and the roster resolve later.
 *
 * THE ACTION ROW IS NEVER SEEDED. Whether this reader may create a channel is a
 * ruling off `my_role`, and the presence stack needs a roster that arrives on
 * its own request. Those keep their shapes, which is what a shape is for.
 */
export function SpaceScreenFrame({
  still = false,
  identity = null,
}: {
  still?: boolean;
  /** The tapped row's identity; `null` on a cold arrival keeps the silhouette. */
  identity?: SpaceFrameIdentity | null;
}) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className={SPACE_LOBBY_COLUMN}>
      <div className="border-b pb-5">
        <div className="flex items-start gap-4">
          {identity ? (
            <SpaceCrest
              uuid={identity.uuid}
              name={identity.name}
              type={identity.type}
              size="lg"
            />
          ) : (
            <CrestSkeleton size="lg" still={still} />
          )}
          {identity ? (
            <div className="min-w-0 flex-1">
              <MetaLine lead={[identity.typeLabel, identity.ownerLabel]} />
              <h1 className="mt-1 flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                <span className="min-w-0 truncate">{identity.name}</span>
                {identity.isPrivate ? (
                  <Lock
                    aria-label="Private space"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                ) : null}
              </h1>
            </div>
          ) : (
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className={cn('h-3 w-40 rounded', bar)} />
              <Skeleton className={cn('h-7 w-2/5 rounded', bar)} />
            </div>
          )}
        </div>
        {identity ? (
          // A space with no description prints nothing, exactly as the live
          // header does. Reserving a bar for prose that is not coming is how
          // the block below ends up moving when it arrives empty.
          identity.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {identity.description}
            </p>
          ) : null
        ) : (
          <Skeleton className={cn('mt-3 h-3.5 w-3/5 rounded', bar)} />
        )}
        {/* The action row is 36px tall, set by the presence stack: `size="md"`
            avatars are 32px and its button pads them by 2px each way. The pill
            below reserved 28px, so this row grew by 4px the moment the roster
            landed and took the whole lobby down with it — measured, 15 August
            2026. The `New channel` button beside it is the shorter 32px. */}
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className={cn('h-9 w-24 rounded-full', bar)} />
          <Skeleton className={cn('h-8 w-32 rounded-md', bar)} />
        </div>
      </div>

      <div className={SPACE_LOBBY_GRID}>
        <div className="min-w-0">
          <Skeleton className={cn('mb-2 h-4 w-28 rounded', bar)} />
          <ChannelListSkeleton still={still} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <div>
            <Skeleton className={cn('mb-2 h-4 w-20 rounded', bar)} />
            {/* The SAME component the live People block draws while its roster
                is in flight, so the fallback reserves the rows and the button
                that are actually coming. */}
            <LobbyPeopleSkeleton still={still} />
          </div>
          <div>
            <Skeleton className={cn('mb-2 h-4 w-16 rounded', bar)} />
            <LobbyFactsSkeleton still={still} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Designed refusals and failures ──────────────────────────────────────── */

/** 403 / 404 — a POLICY refusal, never auto-mapped to verify-email (the
 *  collab model's rule: on collab endpoints a 403 usually means "not a
 *  member"). A refusal is neither an emptiness nor a failure, which is why it
 *  keeps `CollabMessage` rather than either half of the split. */
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

/** Space detail load failure — the PANEL shape, because when the space itself
 *  will not load there is nothing else on this page to hide. */
export function SpaceErrorState({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry: () => void;
}) {
  return (
    <CollabFailure
      presentation="panel"
      title="Couldn't load this space"
      message={
        message?.trim() || 'Something went wrong on our side. Please try again.'
      }
      onRetry={onRetry}
    />
  );
}

/** The channel list failed while the space itself loaded — a STRIP, because
 *  the identity block above it and the regions beside it are fine and must not
 *  be replaced by an apology. */
export function ChannelsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabFailure
      message="We couldn't load this space's channels."
      onRetry={onRetry}
    />
  );
}

/** A quiet impression of the populated digest — the shape the reader is about
 *  to make, so an empty state answers "what will this look like" before the
 *  question is asked. `aria-hidden` + `inert` inside `CollabEmpty`. */
function ChannelsGhost() {
  return (
    <div className="flex flex-col">
      {['w-1/3', 'w-2/5'].map((width) => (
        <div key={width} className="flex items-start gap-3 px-3 py-2.5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Hash className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className={cn('h-4 rounded bg-muted', width)} />
            <div className="h-3 w-3/5 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The designed empty channel list — it teaches what a channel is for and, for
 * someone who can make one, it acts (DIRECTION 13). A member who cannot create
 * channels gets the honest sentence instead of a button that would 403.
 */
export function ChannelsEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <CollabEmpty
      icon={Hash}
      tone={canCreate ? 'accent' : 'neutral'}
      title="No channels yet"
      description={
        canCreate
          ? 'Channels split a space by topic — one for the matter, one for admin, one for anything else. Create the first one and the conversation starts there.'
          : 'Channels in this space will show up here once an owner or admin creates one.'
      }
      ghost={<ChannelsGhost />}
      action={
        canCreate ? (
          <Button size="sm" className="v2-interactive" onClick={onCreate}>
            Create the first channel
          </Button>
        ) : undefined
      }
    />
  );
}
