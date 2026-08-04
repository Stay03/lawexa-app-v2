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
import { channelUnreadGrammar } from '../model';

/**
 * MyChannelRow — one channel in the cross-space "My channels" index. Same
 * unread grammar as the in-space row (bold + gold dot = unread, a gold number
 * is ONLY ever mentions, a muted row's IDENTITY dims and never bolds while its
 * @you badge stays at full strength — the dim is scoped to a wrapper because
 * CSS `opacity` composites its whole subtree, so an anchor-level dim would
 * quiet the one signal Ruling A guarantees), with two differences that belong
 * to a cross-space list:
 *
 *  1. THE SPACE IS NAMED, quietly, beside the channel — without it, two
 *     channels called "general" are indistinguishable, which is the whole
 *     reason a cross-space list needs more than a name.
 *  2. THE LAST MESSAGE IS PREVIEWED (author + snippet). `GET /api/channels` is
 *     the ONLY route that stamps `last_message`, and it is what turns this
 *     list from an index into a place you can triage from. A `null` preview is
 *     honest — it means nothing survives (the last message was deleted) — and
 *     renders as the quiet "No messages yet" rather than an empty line.
 *
 * Phase-5 W4, owner decision D6 — 2026-08-04.
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
  index: number;
}) {
  const { unread, mentions, muted } = channelUnreadGrammar(channel);
  const Icon = channel.visibility === 'private' ? Lock : Hash;
  const age = formatRelativeTime(channel.last_message_at, now);
  const preview = channel.last_message;
  // Scoped to the identity block, never the anchor: `opacity` composites its
  // whole subtree, so a dim on the anchor would take the @you badge down with
  // it (Ruling A). Same rule and same shape as `SpaceChannelRow`.
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
          <span
            aria-hidden
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 motion-reduce:transition-none',
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
              <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
                {channel.space.name}
              </span>
            </span>

            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {preview ? (
                <>
                  <span className="text-foreground/70">{preview.author_name}</span>
                  {`: ${preview.snippet}`}
                </>
              ) : (
                'No messages yet'
              )}
            </span>
          </span>
        </span>

        <span className="mt-1 flex shrink-0 items-center gap-2">
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
        </span>
      </Link>
    </li>
  );
});
