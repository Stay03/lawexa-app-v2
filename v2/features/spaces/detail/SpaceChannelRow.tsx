'use client';

import { memo } from 'react';
import Link from 'next/link';
import { BellOff, Hash, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  channelPreviewLine,
  type RailRow,
} from '@/v2/features/collab/shell/collab-route';
import { ChannelPreviewText } from '@/v2/features/collab/shell/SpaceRail';
import {
  CountBadge,
  FOCUS_RING,
  UnreadDot,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';

/**
 * SpaceChannelRow — one channel in the space lobby's activity digest.
 *
 * ── WHAT CHANGED, AND WHY ──────────────────────────────────────────────────
 * It used to be the space's ENTIRE navigation, in raw API order, showing a
 * description where the cross-space row showed a real last message — which is
 * why the my-channels list read better as a view of a space than the space
 * page did. Navigation is the rail's job now, so this row is free to be what
 * the lobby needs: a digest line that says what was last said here. The
 * preview comes from the one shared derivation
 * (`collab-route.ts#channelPreviewLine`), so the rail, the drawer and this row
 * cannot answer the same question three ways.
 *
 * ── WHAT DID NOT CHANGE, AND MUST NOT ──────────────────────────────────────
 *   `unread_count > 0` and NOT muted → name SEMIBOLD + gold dot + gold glyph.
 *   `mention_count > 0`              → the gold number, and a number is ONLY
 *                                      ever mentions. Shown even when muted:
 *                                      a mute never suppresses a direct @you.
 *   `my_notify_level === 'muted'`    → the row's IDENTITY dims and the
 *                                      bell-off glyph appears; the name can
 *                                      never go bold here, whatever
 *                                      `unread_count` says.
 *
 * THE DIM IS APPLIED TO A WRAPPER around the dimmable parts, NEVER to the
 * anchor: CSS `opacity` composites its whole subtree as one layer, so a
 * descendant `opacity-100` inside a faded parent is a no-op. An anchor-level
 * dim would render a muted channel's @you badge at 60% — muting the exact
 * signal Ruling A guarantees a mute can never suppress. The trailing badge is
 * a SIBLING of the dim wrapper for precisely that reason.
 *
 * Both counts are ABSOLUTE values assigned by the spine's `.channel.unread`
 * writers, so this row moves within a second of a message landing, with no
 * request from the lobby.
 *
 * `memo` holds because `row` comes out of the frame's memoised sections and
 * `now` only moves once a minute — and it is not optional decoration: the
 * React Compiler's transform is not enabled in this repo, so without it every
 * query transition above re-renders the whole digest.
 */
export const SpaceChannelRow = memo(function SpaceChannelRow({
  row,
  now,
}: {
  row: RailRow;
  /**
   * The shared minute clock. `0` is its pre-hydration value and means "no age
   * yet" — handing it to the formatter would date every row as "now".
   */
  now: number;
}) {
  const { channel, grammar } = row;
  const { unread, mentions, muted } = grammar;
  const Icon = channel.visibility === 'private' ? Lock : Hash;
  const age = now > 0 ? formatRelativeTime(channel.last_message_at, now) : '';
  const line = channelPreviewLine(row);
  const preview = line.kind === 'none' ? null : line;
  // THE DIM IS SCOPED, NEVER ON THE ANCHOR — see the docblock. The mention
  // badge must sit OUTSIDE this wrapper.
  const dim = muted
    ? 'opacity-60 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none'
    : undefined;

  return (
    <li>
      {/* NO `aria-current` HERE. This row only ever appears on the space's own
          page, where no channel is open — the ACTIVE-row state belongs to the
          rail, which is the thing that sits beside an open channel. */}
      <Link
        href={`/channels/${channel.uuid}`}
        className={cn(
          'group flex min-w-0 items-start gap-3 rounded-xl px-3 py-2.5',
          'transition-colors duration-150 motion-reduce:transition-none v2-interactive',
          'hover:bg-secondary/50 active:bg-secondary/70',
          FOCUS_RING,
        )}
      >
        <span className={cn('flex min-w-0 flex-1 items-start gap-3', dim)}>
          <span
            aria-hidden
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
              'transition-colors duration-150 motion-reduce:transition-none',
              // The SAME activity test every other collab row uses, so a
              // muted-with-@you channel is warm on every surface.
              unread || mentions > 0
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary text-muted-foreground group-hover:text-foreground',
            )}
          >
            <Icon className="size-[18px]" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                title={channel.name}
                className={cn(
                  'min-w-0 truncate text-[15px] text-foreground',
                  'transition-colors duration-150 group-hover:text-primary motion-reduce:transition-none',
                  unread ? 'font-semibold' : 'font-medium',
                )}
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

            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {preview ? <ChannelPreviewText line={preview} /> : null}
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
