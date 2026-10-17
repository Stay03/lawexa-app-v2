'use client';

import Link from 'next/link';
import { Hash, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SpaceKind, SpaceType } from '@/types/collab';
import { CrestSkeleton, SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { RosterSkeleton } from '@/v2/features/collab/membership/RosterRow';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import type { SpaceTab } from '../model';
import { SpaceContentSkeleton } from './content/states';
import { SPACE_PAGE_COLUMN, SPACE_PILL_BAR } from './lobby-parts';
import { SPACE_HEADER_ROW, SpaceHeading, spaceMembersLabel } from './SpacePlaceHeader';

/**
 * The `/spaces/[spaceId]` states — the loading silhouettes and the designed
 * refusals, shared by the LIVE lobby and the route fallback
 * (`app/v2/(collab)/spaces/[spaceId]/loading.tsx` imports
 * {@link SpaceScreenFrame}), so the two shapes can never drift.
 *
 * ONE APPEARANCE FOR ONE WAIT. The silhouette pulses in the route fallback and
 * on the live screen alike. The reader cannot tell an RSC payload from a
 * request, so a frozen fallback followed by a shimmering pending region would
 * read as the loading starting over halfway through.
 *
 * ── THE FALLBACK DRAWS THE PANE, NOT THE PAGE ──────────────────────────────
 * The rail is rendered by the `(collab)` layout, and `loading.tsx` wraps the
 * PAGE only — Next's Suspense boundary never covers the layout above it. So
 * this silhouette is the lobby alone, and the rail stays interactive beside it
 * throughout. That is the whole point of the frame: a channel switch repaints
 * the pane, never the place.
 */

const NOOP = () => {};

/** One channel-row skeleton at {@link SpaceChannelRow}'s exact geometry — the
 *  36px tile, the two text lines, the right-anchored age. */
function ChannelRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-3 w-3/5 rounded" />
      </div>
      <Skeleton className="mt-1 h-3 w-8 shrink-0 rounded" />
    </div>
  );
}

/** The activity digest's pending shape — rows at the real geometry, with the
 *  house progressive-opacity fade. */
export function ChannelListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.25, 1 - index * 0.18) }}>
          <ChannelRowSkeleton />
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
  /** `spaceHeaderFacts` of the row: the line under the name ("Study ·
   *  Private"). */
  facts: [string, string];
  /** `spacePrincipleLine` of the row: Stay's lines on a shared space. */
  principle: string | null;
  /** The row's own description, or `null`. NOT "not yet loaded" — a space with
   *  no description prints nothing here, and so does this. */
  description: string | null;
  /** The row's `active_members_count`, for "7 members" under the name. */
  membersCount: number;
  /** `team` or `shared` (an absent kind on the row reads as `team`). */
  kind: SpaceKind;
}

/**
 * The space home's silhouette: the header (crest, name, the line under it),
 * the pill bar and the list. Geometry mirrors the live home, so the hand-off
 * is content resolving rather than a layout swap.
 *
 * ── AND IT TAKES THE IDENTITY THE LIST ALREADY HAD ─────────────────────────
 * Owner, 15 August 2026: "for spaces the first skeleton is a full skeleton, the
 * second one has some text and images and stuff". Two loading states that do
 * not look alike read as two pages, not one page arriving. The row the reader
 * tapped carries the crest, the name, the line under it (with the members
 * count), its description and so Stay's lines, so with `identity` supplied the
 * first state IS the second one, and only the list resolves later.
 *
 * ── THE PANEL OF THE PILL THAT WILL OPEN ───────────────────────────────────
 * The People pill draws the roster's shape; every other pill draws rows (the
 * list's rows share one geometry, `SpaceContentSkeleton`). The add control a
 * pill carries is a ruling off the reader's role, so it is never reserved.
 */
export function SpaceScreenFrame({
  identity = null,
  tab,
}: {
  /** The tapped row's identity; `null` on a cold arrival keeps the silhouette. */
  identity?: SpaceFrameIdentity | null;
  /** The pill the page will open on. */
  tab: SpaceTab;
}) {
  return (
    <div className={SPACE_PAGE_COLUMN}>
      <div className={SPACE_HEADER_ROW}>
        {identity ? (
          <SpaceCrest uuid={identity.uuid} name={identity.name} type={identity.type} size="md" />
        ) : (
          <CrestSkeleton size="md" />
        )}
        {identity ? (
          <div className="min-w-0 flex-1">
            {/* The live header's own heading, so the hand-off moves nothing
                and the shell bar's title steps back from the first frame. */}
            <SpaceHeading
              name={identity.name}
              // The same shape as the live name when it opens the details
              // (the chevron), so the hand-off adds nothing; the sheet is the
              // live screen's, so a tap here waits for it.
              onOpenAbout={identity.description || identity.principle ? NOOP : undefined}
            />
            <MetaLine
              className="mt-0.5 text-sm"
              lead={identity.facts}
              trail={[spaceMembersLabel(identity.membersCount)]}
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-6 w-3/5 rounded md:h-7 md:w-2/5" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
        )}
      </div>

      {/* The live pill bar's box: the five pills, then the search. */}
      <div aria-hidden className={SPACE_PILL_BAR}>
        <Skeleton className="h-9 w-[21rem] max-w-full shrink-0 rounded-full" />
        {tab === 'people' ? null : <Skeleton className="h-11 min-w-0 flex-1 rounded-4xl" />}
      </div>

      <div className="mt-4">
        {tab === 'people' ? (
          // The People pill's own pending shape: the count line, then the rows.
          <div className="flex flex-col gap-6">
            <Skeleton className="h-4 w-24 rounded" />
            <RosterSkeleton />
          </div>
        ) : (
          <SpaceContentSkeleton />
        )}
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
