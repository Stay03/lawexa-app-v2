'use client';

import { memo } from 'react';
import Link from 'next/link';
import { BellOff, Hash, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Channel } from '@/types/collab';
import {
  CountBadge,
  FOCUS_RING,
  UnreadDot,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';
import { channelUnreadGrammar } from '@/v2/features/channels/model';
import { memberCountLabel } from '../model';

/**
 * SpaceChannelRow — one channel inside a space, on the LIVE unread model
 * (study A2's FIX: v1 rendered a static `unread_count` that only moved on a
 * refetch — audit §8 item 2).
 *
 * ── WHAT DRIVES WHAT (DIRECTION 2; backend Ruling A) ───────────────────────
 *   `unread_count > 0` and NOT muted → name SEMIBOLD + gold dot + gold glyph.
 *   `mention_count > 0`              → the gold number, and a number is ONLY
 *                                      ever mentions. Shown even when muted:
 *                                      a mute never suppresses a direct @you.
 *   `my_notify_level === 'muted'`    → the row's IDENTITY dims (glyph, name,
 *                                      meta, age) and the bell-off glyph
 *                                      appears; the name can never go bold
 *                                      here, whatever `unread_count` says.
 *                                      Mute is honoured EXACTLY — "muting
 *                                      that doesn't fully silence" is the top
 *                                      complaint the research names.
 *
 * ── WHERE THE MUTED DIM MAY LIVE, AND WHY IT MATTERS ───────────────────────
 * The dim is applied to a WRAPPER around the dimmable parts, never to the
 * anchor: CSS `opacity` composites its whole subtree as one layer, so a
 * descendant `opacity-100` inside a faded parent is a no-op. An anchor-level
 * dim would therefore render a muted channel's @you badge at 60% — muting the
 * exact signal Ruling A guarantees a mute can never suppress. The trailing
 * badge is a sibling of the dim wrapper for precisely that reason.
 *
 * Both counts are ABSOLUTE values assigned by the spine's `.channel.unread`
 * writers, so this row moves within a second of a message landing, with no
 * request from the space screen.
 *
 * ── THE META LINE'S TWO ZONES ──────────────────────────────────────────────
 * LEAD: what the channel is (its description, or the honest "No messages yet"
 * when it has neither description nor history). TRAIL: the member count,
 * right-anchored so the counts read down the column, with the last-activity
 * age beside the badge on the title line — the fact that ranks the row sits
 * where the eye already is.
 *
 * `memo` holds because the spine's writers are reference-stable on a no-op.
 * Phase-5 W4, 2026-08-04.
 */
export const SpaceChannelRow = memo(function SpaceChannelRow({
  channel,
  now,
  index,
}: {
  channel: Channel;
  /** Frozen clock for the relative age — threaded from the screen's lazy
   *  `useState` so no `Date.now()` runs in render (React Compiler lint). */
  now: number;
  index: number;
}) {
  const { unread, mentions, muted } = channelUnreadGrammar(channel);
  const Icon = channel.visibility === 'private' ? Lock : Hash;
  const age = formatRelativeTime(channel.last_message_at, now);
  // THE DIM IS SCOPED, NEVER ON THE ANCHOR — see the docblock. `opacity` on a
  // parent composites the whole subtree, so a descendant `opacity-100` cannot
  // undo it; the mention badge must therefore sit OUTSIDE this wrapper.
  const dim = muted
    ? 'opacity-60 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none'
    : undefined;

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <Link
        href={`/channels/${channel.uuid}`}
        className={cn(
          'group flex min-w-0 items-start gap-3 rounded-lg px-2 py-3',
          'transition-colors duration-150 hover:bg-secondary/50 active:bg-secondary/70',
          'motion-reduce:transition-none v2-interactive',
          FOCUS_RING,
        )}
      >
        <span className={cn('flex min-w-0 flex-1 items-start gap-3', dim)}>
          <Icon
            aria-hidden
            className={cn(
              'mt-0.5 size-[18px] shrink-0 transition-colors duration-150 motion-reduce:transition-none',
              // `unread || mentions` — the SAME activity test the spaces list
              // row and the my-channels row use for their tiles, so a
              // muted-with-@you channel (unread false, mentions > 0) is warm
              // on every surface instead of warm on one and cold on another.
              unread || mentions > 0 ? 'text-primary' : 'text-muted-foreground',
            )}
          />

          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'min-w-0 truncate text-[15px] text-foreground transition-colors duration-150 group-hover:text-primary motion-reduce:transition-none',
                  unread ? 'font-semibold' : 'font-medium',
                )}
                title={channel.name}
              >
                {channel.name}
              </span>
              {unread ? <UnreadDot /> : null}
              {muted ? (
                <BellOff
                  aria-label="Muted"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              ) : null}
            </span>

            <span className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">
                {channel.description?.trim() ||
                  (channel.last_message_at ? '' : 'No messages yet')}
              </span>
              <span className="shrink-0 tabular-nums">
                {memberCountLabel(channel.active_members_count)}
              </span>
            </span>
          </span>
        </span>

        <span className="mt-1 flex shrink-0 items-center gap-2">
          {/* OUTSIDE the dim wrapper, which is the only way it can stay at full
              strength on a muted row (Ruling A's one guaranteed-loud signal). */}
          {mentions > 0 ? (
            <CountBadge
              count={mentions}
              label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${channel.name}`}
            />
          ) : null}
          {age ? (
            <span className={cn('text-xs tabular-nums text-muted-foreground', dim)}>
              {age}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
});
