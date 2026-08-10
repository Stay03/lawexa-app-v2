'use client';

import { memo } from 'react';
import Link from 'next/link';
import { BellOff } from 'lucide-react';

import { channelVisibilityFace } from '@/lib/collab/visibility';

import { cn } from '@/lib/utils';
import type { Channel } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import {
  CountBadge,
  FOCUS_RING,
  UnreadDot,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';
import { channelUnreadGrammar } from '../model';

/**
 * MyChannelRow — one channel in the cross-space `/channels` index.
 *
 * ── IT LEADS WITH THE SPACE, NOT WITH A HASH ───────────────────────────────
 * Every other cross-space list in the wave led with the same grey glyph, so a
 * list of thirty channels from six spaces was READ line by line. The 36px
 * `SpaceCrest` gives each space a fixed hue and monogram, so the left edge of
 * this list becomes the answer to "which of my places is this" before a single
 * word is read — the whole reason a cross-space list is worth having. The
 * crest is the SAME mark, at the same hue, that the space lane and the channel
 * breadcrumb carry, and it deliberately does NOT change under unread: an
 * identity that restyles itself under load is not an identity.
 *
 * The channel's own kind moves onto the title line as the `#` / lock glyph it
 * always was, where it sits next to the name it qualifies.
 *
 * ── THE UNREAD GRAMMAR, UNCHANGED ──────────────────────────────────────────
 * Bold + gold dot = unread. A gold number is ONLY ever mentions. A muted row's
 * IDENTITY dims and never bolds, while its @you badge stays at full strength —
 * which is why the dim lives on a WRAPPER and the badge is that wrapper's
 * SIBLING: CSS `opacity` composites its whole subtree, so an anchor-level dim
 * would quiet the one signal Ruling A guarantees.
 *
 * ── THE PREVIEW IS THE ROW'S VALUE ─────────────────────────────────────────
 * `GET /api/channels` is the ONLY route that stamps `last_message`, and it is
 * what makes this list triage rather than an index. A `null` preview is
 * honest — nothing survives — and renders as the quiet "No messages yet".
 *
 * Phase-5 W4 (owner decision D6); rebuilt for the redesign wave, 2026-08-05.
 */
export const MyChannelRow = memo(function MyChannelRow({
  channel,
  now,
  index,
}: {
  channel: Channel;
  /** Frozen clock — threaded from the screen's lazy `useState` so no
   *  `Date.now()` runs in render (React Compiler lint). */
  now: number;
  /** Position across ALL sections — drives the entrance stagger. */
  index: number;
}) {
  const { unread, mentions, muted } = channelUnreadGrammar(channel);
  // MISSED BY THE FIRST SWEEP, reported by @arthur: a hidden channel drew the
  // OPEN mark here. The sweep that replaced the other sites read a TRUNCATED
  // grep as if it were the whole list.
  const visibilityFace = channelVisibilityFace(channel.visibility);
  const Glyph = visibilityFace.icon;
  const age = formatRelativeTime(channel.last_message_at, now);
  const preview = channel.last_message;
  const dim = muted
    ? 'opacity-60 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none'
    : undefined;

  return (
    <li
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      // Capped low on purpose: a triage list must SETTLE, not perform. The
      // tail was 350ms, which is longer than the motion itself.
      style={{ animationDelay: `${Math.min(index, 6) * 20}ms` }}
    >
      <Link
        href={`/channels/${channel.uuid}`}
        className={cn(
          'group flex min-w-0 items-start gap-3 rounded-xl px-2 py-3',
          'transition-colors duration-150 hover:bg-secondary/50 active:bg-secondary/70',
          'motion-reduce:transition-none v2-interactive',
          FOCUS_RING,
        )}
      >
        {/* The dim wrapper — identity only. A `<div>`, not a `<span>`: it holds
            a `MetaLine`, which renders `<div>`s by contract, and a `<div>`
            inside a `<span>` is invalid. An `<a>` accepts flow content, so the
            whole-row link still nests correctly. */}
        <div className={cn('flex min-w-0 flex-1 items-start gap-3', dim)}>
          <SpaceCrest
            uuid={channel.space.uuid}
            name={channel.space.name}
            type={channel.space.type}
            size="md"
            className="mt-0.5"
          />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <Glyph
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/70"
              />
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
            </div>

            {/* Two-zone meta: the space names the place, the preview says what
                is happening in it. Both truncate; neither ever wraps. */}
            <MetaLine
              className="mt-1"
              lead={[
                channel.space.name,
                preview ? (
                  <span key="preview" className="min-w-0 truncate">
                    <span className="text-foreground/70">{preview.author_name}</span>
                    {`: ${preview.snippet}`}
                  </span>
                ) : (
                  'No messages yet'
                ),
              ]}
            />
          </div>
        </div>

        <div className="mt-1 flex shrink-0 items-center gap-2">
          {/* Sibling of the dim wrapper, so a muted channel's @you stays at
              full strength — the one signal a mute may never quiet. */}
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
        </div>
      </Link>
    </li>
  );
});
