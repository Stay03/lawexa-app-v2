'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Briefcase, GraduationCap, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Space } from '@/types/collab';
import { CountBadge, FOCUS_RING, UnreadDot } from '@/v2/shell/designs/modules';
import { memberCountLabel, spaceOwnerLabel, spaceUnreadGrammar } from '../model';

/**
 * SpaceRow — one space, in the house list-row anatomy (study A1: v1's card grid
 * is REDESIGNED into rows, because a card grid matches no other v2 list
 * surface). Tile → title (+ marks) → two-zone meta → optional description, with
 * the activity signal on the right edge.
 *
 * ── THE UNREAD GRAMMAR, WHICH IS THE POINT OF THIS ROW (DIRECTION 2) ────────
 * v1 rendered NO activity here at all, even though the payload has carried the
 * §17 rollups since phase 1 (audit §8 item 2). This row spends them:
 *
 *   `unread_channels_count > 0` → the name goes SEMIBOLD, a small gold dot sits
 *                                 beside it, and the tile warms to gold. Muted
 *                                 channels are already excluded server-side, so
 *                                 a space whose only noisy channel is muted
 *                                 stays quiet — Ruling A, for free.
 *   `mention_count > 0`         → the gold numeric badge on the right. A NUMBER
 *                                 IS ONLY EVER MENTIONS. Muted channels are
 *                                 INCLUDED here: a mute never suppresses a
 *                                 direct @you.
 *   neither                     → the quiet row: medium weight, secondary tile,
 *                                 no marks. Most rows, most of the time.
 *
 * No red anywhere — red is reserved for failure and destructive actions.
 * Between refetches both fields are kept live by the realtime spine's cache
 * writers, so a message arriving in another space moves this row within a
 * second without any request from this screen.
 *
 * `memo` holds because the spine's writers are reference-stable on a no-op: a
 * rollup change in one space re-renders that row and leaves the other
 * forty-nine alone. Phase-5 W4, 2026-08-04.
 */
export const SpaceRow = memo(function SpaceRow({
  space,
  index,
}: {
  space: Space;
  /** Staggers the entrance for the first screenful only. */
  index: number;
}) {
  const { unread, mentions } = spaceUnreadGrammar(space);
  const Icon = space.type === 'study' ? GraduationCap : Briefcase;
  const active = unread || mentions > 0;

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
          'group flex min-w-0 items-start gap-3 rounded-lg px-2 py-3',
          'transition-colors duration-150 hover:bg-secondary/50 active:bg-secondary/70',
          'motion-reduce:transition-none v2-interactive',
          FOCUS_RING,
        )}
      >
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 motion-reduce:transition-none',
            active
              ? 'bg-primary/10 text-primary'
              : 'bg-secondary text-muted-foreground group-hover:text-foreground',
          )}
        >
          <Icon className="size-[18px]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
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
          </span>

          {/* Two zones: what the space IS on the left, how big it is on the
              right — right-anchored on every row, so the member counts read
              straight down the column. Under pressure the lead truncates and
              the trail stays put. */}
          <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0">{space.type_label}</span>
              <Dot />
              <span className="min-w-0 truncate">{spaceOwnerLabel(space)}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {memberCountLabel(space.active_members_count)}
            </span>
          </span>

          {space.description ? (
            <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {space.description}
            </span>
          ) : null}
        </span>

        {mentions > 0 ? (
          // `mt-1.5` lands the badge on the title's optical centre, so the
          // badges line up with each other down the right edge.
          <span className="mt-1.5 shrink-0">
            <CountBadge
              count={mentions}
              label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${space.name}`}
            />
          </span>
        ) : null}
      </Link>
    </li>
  );
});

/** The meta line's separator — decorative, so it never reaches a screen reader
 *  as a word, and `shrink-0` so it can never be the thing that collapses. */
function Dot() {
  return (
    <span aria-hidden className="shrink-0 text-muted-foreground/40">
      ·
    </span>
  );
}
