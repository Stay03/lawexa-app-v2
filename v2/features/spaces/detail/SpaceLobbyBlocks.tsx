'use client';

import { useMemo } from 'react';
import { Building2, Globe, Lock, PanelLeft, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatDayLabel } from '@/lib/utils/collab';
import type { Channel, Member, MemberRole, Space } from '@/types/collab';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import type { RailSections } from '@/v2/features/collab/shell/collab-route';
import { CONTENT_FADE } from '@/v2/shell/designs/modules';
import { spaceOwnerLabel } from '../model';
import { buildActivityDigest } from './activity-digest';
import { LobbyFact, LobbyPeopleSkeleton, LobbySection } from './lobby-parts';
import { SpaceChannelRow } from './SpaceChannelRow';
import { SpaceThreadRow } from './SpaceThreadRow';
import {
  ChannelListSkeleton,
  ChannelsEmptyState,
  ChannelsErrorState,
} from './states';

/**
 * SpaceLobbyBlocks — the three regions that make `/spaces/{uuid}` a lobby
 * rather than a menu.
 *
 * ── WHAT IS HERE, AND WHAT IS NOT, IS DECIDED BY THE WIRE ──────────────────
 * The brief asked for four blocks: what is active today, the people, recent
 * files, and lists in progress. Two of them are built. The other two are NOT,
 * and the reason is not effort:
 *
 *   RECENT FILES and LISTS IN PROGRESS are per-CHANNEL resources
 *   (`GET /channels/{uuid}/files`, `GET /channels/{uuid}/lists`). There is no
 *   space-level route for either, so a space with twelve channels would cost
 *   twenty-four requests on every visit to this page — and the reads are not
 *   even open: a space member previewing a `space_public` channel they have
 *   not joined is refused BOTH, so a good share of those requests would be
 *   403s landing inside live queries, which is the one shape the access model
 *   forbids. A block that cannot be built honestly is left out rather than
 *   faked from a subset, and the fix is a backend ask, not a loop.
 *
 * FACES PER CHANNEL are missing for the same kind of reason: the channel list
 * carries `active_members_count` and no roster, so the activity rows show
 * what was last SAID rather than who is in the room. The space's own people
 * are right beside them, which is where the faces genuinely are.
 *
 * THREADS were the third case, and they are the one that got fixed. The
 * space's §17 mention rollup COUNTS them while `/spaces/{uuid}/channels`
 * FILTERS them (`topLevel()`), so the owner was tagged in a thread, opened
 * the space, and met a badge bigger than everything this page could show
 * (measured 2026-08-14: space said 54, its one busy channel row said 9). The
 * activity digest merges thread rows with the channel rows, newest first, and
 * since 2026-08-16 it is fed by a real route: `GET /spaces/{uuid}/threads`,
 * read through `channelsQueries.threadsBySpace` and injected by `SpaceScreen`
 * through the `threads` prop. The ranking seam is `activity-digest.ts`.
 *
 * ── THE DIGEST IS THE ONLY CHANNEL LIST BELOW `lg:` ────────────────────────
 * The rail docks at `lg:`; below it the drawer holds the full list and this
 * block is what the reader actually lands on. That is why its ranking includes
 * MUTED rooms at the end rather than dropping them: a reader who had muted
 * everything used to meet an empty "Active here" with every room they own
 * hidden behind a drawer nothing pointed at.
 */

/* ── Active here ──────────────────────────────────────────────────────────── */

/** How many rows the digest shows before the rail (or the drawer) takes
 *  over. Six is about a screenful beside the People and About regions. */
const DIGEST_LIMIT = 6;

export function SpaceActivityBlock({
  sections,
  threads,
  isPending,
  isError,
  onRetry,
  canCreate,
  onCreateChannel,
  onOpenRail,
  now,
}: {
  sections: RailSections;
  /**
   * The space's recently active THREADS, merged into the digest beside the
   * channels — because the space's own mention rollup counts them and this
   * block is where that number must be explainable. Empty is a real answer (a
   * space where nobody has branched anything) and reads as one: the heading
   * simply omits the thread fact. `SpaceScreen` owns the fetch; the empty
   * default must be a stable reference, which is what `NO_SPACE_THREADS` in
   * `activity-digest.ts` is for.
   */
  threads: readonly Channel[];
  /** Both halves of the digest, not just the channels: the caller ORs the two
   *  queries, because a single ranked list drawn half-built shows a wrong
   *  order. Same for `isError` / `onRetry`. */
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  canCreate: boolean;
  onCreateChannel: () => void;
  /** Opens the space drawer — the full channel list below `lg:`. */
  onOpenRail: () => void;
  now: number;
}) {
  // Memoised so the row objects keep their references between renders and the
  // rows' `memo` holds — `sections` comes out of the frame's own memo and
  // `threads` is either a query result (stable while the entry is) or the one
  // frozen empty constant.
  const digest = useMemo(
    () => buildActivityDigest(sections, threads, DIGEST_LIMIT),
    [sections, threads],
  );
  const meta = isPending ? null : digest.meta;
  // Empty means NOTHING is known here — no channels and no threads. Guarding
  // on channels alone would blank real thread rows behind an empty state.
  const isEmpty = sections.total === 0 && threads.length === 0;

  return (
    <LobbySection
      title="Active here"
      meta={meta}
      action={
        sections.total > 0 ? (
          // Below `lg:` there is no docked rail, so this is the way to the
          // channels the digest did not show. At `lg:` the rail already lists
          // every one of them a few inches to the left.
          <Button
            variant="outline"
            size="sm"
            className="v2-interactive lg:hidden"
            onClick={onOpenRail}
          >
            <PanelLeft aria-hidden className="size-4" />
            All channels
          </Button>
        ) : null
      }
    >
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? 'Loading channels' : ''}
      </span>

      {isPending ? (
        <ChannelListSkeleton />
      ) : isError && isEmpty ? (
        <ChannelsErrorState onRetry={onRetry} />
      ) : isEmpty ? (
        <ChannelsEmptyState canCreate={canCreate} onCreate={onCreateChannel} />
      ) : (
        <ul className={cn('flex flex-col', CONTENT_FADE)}>
          {digest.rows.map((row) =>
            row.kind === 'channel' ? (
              <SpaceChannelRow key={row.row.channel.uuid} row={row.row} now={now} />
            ) : (
              <SpaceThreadRow key={row.thread.uuid} row={row} now={now} />
            ),
          )}
        </ul>
      )}
    </LobbySection>
  );
}

/* ── People ───────────────────────────────────────────────────────────────── */

/** Owner, then admins, then everyone else; alphabetical inside each rank — the
 *  order a reader would name them in. */
const ROLE_RANK: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 };

/** How many names the block lists before the roster takes over. */
const PEOPLE_LIMIT = 5;

export function SpacePeopleBlock({
  space,
  members,
  isPending,
  canManage,
  onOpenRoster,
}: {
  space: Space;
  members: readonly Member[];
  isPending: boolean;
  canManage: boolean;
  onOpenRoster: () => void;
}) {
  const active = members
    .filter((member) => member.is_active && !member.is_pending)
    .sort((left, right) => {
      const byRank = ROLE_RANK[left.role] - ROLE_RANK[right.role];
      return byRank !== 0 ? byRank : left.user.name.localeCompare(right.user.name);
    });
  const shown = active.slice(0, PEOPLE_LIMIT);
  const rest = space.active_members_count - shown.length;

  /**
   * ONE DOOR, LABELLED BY WHAT IS BEHIND IT. There used to be an "Invite"
   * button in the heading wired to the same handler as the button below it —
   * the same door, 30px apart, under two different promises — and the lower
   * one said "Manage people" to a plain member, every verb behind which is
   * `canManage`-gated. Inviting lives inside the roster sheet, where it always
   * has; this is the way in, and it says which way in it is.
   */
  const rosterLabel =
    rest > 0
      ? `See all ${space.active_members_count}`
      : canManage
        ? 'Manage people'
        : 'See everyone';

  return (
    <LobbySection title="People">
      {isPending && active.length === 0 ? (
        <LobbyPeopleSkeleton />
      ) : active.length === 0 ? (
        // Not an emptiness worth a panel: a space always has at least its
        // creator, so this only appears when the roster is withheld.
        <p className="text-xs text-muted-foreground">
          {`${space.active_members_count} ${space.active_members_count === 1 ? 'member' : 'members'}.`}
        </p>
      ) : (
        <ul className={cn('flex flex-col', CONTENT_FADE)}>
          {shown.map((member) => (
            <li key={member.user.uuid} className="flex items-center gap-2 py-1">
              <MemberAvatar user={member.user} size="sm" />
              <span
                title={member.user.name}
                className="min-w-0 flex-1 truncate text-xs text-foreground"
              >
                {member.user.name}
              </span>
              {member.role === 'member' ? null : (
                <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {member.role_label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="v2-interactive mt-1 w-full justify-start gap-2 px-1 text-muted-foreground hover:text-foreground"
        onClick={onOpenRoster}
      >
        <Users aria-hidden className="size-4" />
        {rosterLabel}
      </Button>
    </LobbySection>
  );
}

/* ── About ────────────────────────────────────────────────────────────────── */

/**
 * The facts that place a space — every one of them straight off the wire. It
 * exists because privacy in particular had been a 12px sentence under a switch
 * in a dialog and then nowhere at all: a member should be able to answer "can
 * anyone in my firm find this?" from the space's own page.
 */
export function SpaceAboutBlock({ space }: { space: Space }) {
  const created = formatDayLabel(space.created_at);
  return (
    <LobbySection title="About">
      {/* NO ENTRANCE HERE. `CONTENT_FADE` is the swap a region plays when it
          REPLACES its own skeleton; this region has no live pending state —
          it renders the moment the space does, alongside the header — so a
          fade would be an entrance with nothing to enter from. */}
      <dl className="flex flex-col divide-y divide-border/60">
        <LobbyFact term="Visibility">
          <span className="inline-flex items-center gap-1.5">
            {space.is_private ? (
              <Lock aria-hidden className="size-3 text-muted-foreground" />
            ) : (
              <Globe aria-hidden className="size-3 text-muted-foreground" />
            )}
            {/* NOT "Open to the organization". The create form calls this exact
                state "anyone can find it and join without an invitation", and
                until 2026-08-10 the flag did nothing so the disagreement was
                harmless. It is a real setting now, and a personal space has no
                organization for the old wording to even refer to. */}
            {space.is_private ? 'Private' : 'Open to anyone'}
          </span>
        </LobbyFact>
        <LobbyFact term="Kind">{space.type_label}</LobbyFact>
        <LobbyFact term="Owner">
          <span className="inline-flex items-center gap-1.5">
            {space.organization ? (
              <Building2 aria-hidden className="size-3 text-muted-foreground" />
            ) : null}
            {spaceOwnerLabel(space)}
          </span>
        </LobbyFact>
        <LobbyFact term="Created by">{space.creator.name}</LobbyFact>
        {created ? <LobbyFact term="Created">{created}</LobbyFact> : null}
      </dl>
    </LobbySection>
  );
}
