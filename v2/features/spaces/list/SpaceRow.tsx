'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SlimUser, Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import {
  CountBadge,
  FOCUS_RING,
  UnreadDot,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';
import { memberCountLabel, spaceOwnerLabel, spaceUnreadGrammar } from '../model';
import type { SpaceActivity } from './space-activity';

/**
 * SpaceRow — one space as a PLACE LANE: a bounded object with its own edges,
 * led by its crest, saying what is happening inside it. It is no longer the
 * `ModuleRow` silhouette a bookmark, a case and a conversation also wear —
 * because a space is not a document, and a list where every kind of thing has
 * the same outline is read rather than recognised.
 *
 * ── THE ANATOMY ────────────────────────────────────────────────────────────
 *   [ crest 48 ]  name · unread dot · lock                    [ mentions ]
 *                 •#general #matter-4471 more · Acme  12 members · 2h
 *
 * The DESCRIPTION is gone from the lane on purpose. It swung the row between
 * two and four lines against a two-line skeleton, and it answers a question
 * ("what is this space for") that belongs on the space's own page, not in a
 * list being scanned for activity. The OWNER is not gone: on an account that
 * belongs to an organization, WHOSE space this is changes what it means, so
 * the org name stays on the meta line whether or not chips are there too.
 * "Personal" appears only in the no-chips fallback — it is the ABSENCE of an
 * owner, and it does not earn width beside live channel names.
 *
 * ── THE UNREAD GRAMMAR, UNCHANGED (DIRECTION 2, backend Ruling A) ───────────
 *   `unread_channels_count > 0` → the name goes SEMIBOLD with a gold dot
 *                                 beside it. Muted channels are excluded
 *                                 server-side, so a space whose only noisy
 *                                 channel is muted stays quiet.
 *   `mention_count > 0`         → the gold numeric badge on the right. A
 *                                 NUMBER IS ONLY EVER MENTIONS, and muted
 *                                 channels ARE counted: a mute never
 *                                 suppresses a direct @you.
 *   neither                     → the quiet lane. Most lanes, most of the time.
 * No red anywhere. Nothing here dims, because mute is per-channel and a space
 * is never muted — so the badge needs no dim-wrapper sibling to escape.
 *
 * THE BADGE IS THE ONLY NUMERAL ON THE LANE. The member count is words ("12
 * members") and the channel overflow is the word "more", so nothing on the row
 * competes with the one figure that carries meaning. Two numerals told apart
 * by colour alone is exactly the ambiguity that rule exists to prevent.
 *
 * ── THE CREST DOES NOT REACT TO ACTIVITY ───────────────────────────────────
 * The old tile warmed to gold on unread, which put a second gold object beside
 * the badge that carries the real number and made the identity mark move under
 * load. The crest is constant; bold, dot and badge carry all the signal.
 *
 * ── THE CHANNEL CHIPS ARE THE SECOND LINE, WHEN THERE ARE ANY ──────────────
 * Chips come from the viewer's cross-space channel cache (see
 * `space-activity.ts` for what that is one page of, and for why the overflow
 * is a word and not a number). An unread chip is marked by a SOLID GOLD DOT
 * plus foreground text at medium weight — the house unread grammar, at chip
 * scale. It is deliberately not a gold wash: measured, `bg-primary/15` over
 * the page reaches 1.13:1 in light and 1.01:1 in dark against the neighbouring
 * quiet chip, which is no signal at all, while the solid dot measures 4.33:1
 * light and 7.31:1 dark. Gold works as a small solid mark and never survives
 * as a tint.
 *
 * With no chips known — a space the viewer has joined no channel in, or a
 * cache that has not reached it — the line names what the space IS instead, so
 * the lane never renders an empty column.
 *
 * `memo` still earns its place: a rollup change in one space re-renders that
 * lane and leaves the others alone. It does yield when the channel cache
 * moves, because that is precisely when the chips must change.
 */

/** One frozen empty roster. `GET /api/spaces` attaches `members` only on
 *  `show`, so on this screen every lane resolves to this — sharing the
 *  reference keeps the memo from churning on a value that is always absent. */
const NO_FACES: readonly SlimUser[] = [];

export const SpaceRow = memo(function SpaceRow({
  space,
  activity,
  now,
  index,
}: {
  space: Space;
  /** The viewer's channels in this space — chips, overflow, latest activity. */
  activity: SpaceActivity;
  /** Frozen clock for the relative age (React Compiler lint). */
  now: number;
  /** Staggers the entrance for the first screenful only. */
  index: number;
}) {
  const { unread, mentions } = spaceUnreadGrammar(space);
  const age = formatRelativeTime(activity.lastMessageAt, now);
  const hasChips = activity.chips.length > 0;
  const memberWords = memberCountLabel(space.active_members_count);
  const faces = space.members
    ? space.members.filter((member) => member.is_active).map((member) => member.user)
    : NO_FACES;

  return (
    <li
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1',
        'motion-safe:fill-mode-both motion-safe:duration-200',
      )}
      // Capped so a long list never staggers into a visible delay.
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <Link
        href={`/spaces/${space.uuid}`}
        className={cn(
          'group flex min-h-20 min-w-0 items-center gap-3.5 rounded-xl border border-border bg-background px-3 py-3',
          'transition-colors duration-150 hover:bg-secondary/40',
          'motion-reduce:transition-none v2-interactive',
          FOCUS_RING,
        )}
      >
        <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="lg" />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                'min-w-0 truncate text-[15px] text-foreground transition-colors duration-150 group-hover:text-primary motion-reduce:transition-none',
                unread ? 'font-semibold' : 'font-medium',
              )}
              title={space.name}
            >
              {space.name}
            </span>
            {unread ? <UnreadDot /> : null}
            {space.is_private ? (
              <Lock
                aria-label="Private space"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            ) : null}
          </div>

          <MetaLine
            className="mt-1.5"
            lead={
              hasChips
                ? [
                    <ChannelChips key="chips" activity={activity} />,
                    space.organization?.name ?? null,
                  ]
                : [space.type_label, spaceOwnerLabel(space)]
            }
            trail={[
              <PresenceStack
                key="members"
                members={faces}
                total={space.active_members_count}
                countLabel={memberWords}
                label={`${memberWords} in ${space.name}`}
              />,
              age,
            ]}
          />
        </div>

        {mentions > 0 ? (
          <CountBadge
            count={mentions}
            label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${space.name}`}
          />
        ) : null}
      </Link>
    </li>
  );
});

/**
 * The live second line: up to three channel names, unread ones marked with the
 * house gold dot, then the honest word for "there are others".
 *
 * NO PLINTH BEHIND THE CHIPS. A tinted ground looked tidier and cost contrast
 * it could not pay for: `bg-secondary/70` moves the page by 1.07:1 in light —
 * invisible — while dragging `text-muted-foreground` from 4.73:1 down to
 * 4.43:1, under DIRECTION 11's floor. Plain text on the page keeps the read
 * chip at 4.73:1 / 7.63:1 and the gold dot at 4.33:1 / 7.31:1, and `#` is a
 * strong enough token boundary that the ground was never doing the separating.
 */
function ChannelChips({ activity }: { activity: SpaceActivity }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {activity.chips.map((chip) => (
        <span
          key={chip.uuid}
          className={cn(
            'inline-flex min-w-0 items-center gap-1 text-[11px]',
            chip.unread ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {chip.unread ? (
            <span
              aria-label="Unread"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          ) : null}
          <span className="min-w-0 truncate">{`#${chip.name}`}</span>
        </span>
      ))}
      {activity.hasMore ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">more</span>
      ) : null}
    </span>
  );
}
