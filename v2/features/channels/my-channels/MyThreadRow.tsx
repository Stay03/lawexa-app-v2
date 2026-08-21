'use client';

import { memo } from 'react';
import Link from 'next/link';
import { BellOff, GitBranch } from 'lucide-react';

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
import {
  channelDisplayName,
  threadProvenanceLabel,
  threadUnreadState,
} from '../thread-model';

/**
 * MyThreadRow — one THREAD in the cross-space `/channels` index, drawn to
 * `MyChannelRow`'s exact geometry so the merged list reads as one list: same
 * 36px leading crest, same title size, same two-fact meta line, same trailing
 * cluster, same entrance stagger. What differs is only what IS different about
 * a thread.
 *
 * ── IT LEADS WITH THE SPACE, NOT WITH A BRANCH TILE ────────────────────────
 * The space lobby's `SpaceThreadRow` leads with a branch tile, and it is right
 * to: there every row is from one space, so the tile is the only thing telling
 * the two kinds apart. Here it would be wrong. This list's whole reason to
 * exist is that it crosses spaces, and its left edge is the answer to "which of
 * my places is this" before a word is read - a thread row that broke that
 * column would punch a hole in the one column the reader scans. So the crest
 * leads, exactly as on a channel row, and the branch glyph takes the title-line
 * slot where a channel prints its `#` or lock: the same place, the same size,
 * qualifying the same name.
 *
 * ── THE GRAMMAR IS `ThreadsSheet`'s, NOT A NEW ONE ─────────────────────────
 * Title tone follows the three-state thread grammar a reader already learnt
 * under a message: not following is muted ink (a door, not an obligation),
 * caught up is full strength, behind is semibold plus the house gold dot. The
 * gold NUMBER is a mention count and only ever that.
 *
 * ── THE SECOND LINE IS THE SPACE, THEN WHERE IT BRANCHED FROM ──────────────
 * A channel row spends its second fact on the last-message preview, which is
 * the row's value and which `GET /threads` does not stamp (only `GET /channels`
 * carries `last_message`). A thread spends it on `parent_channel_name` instead,
 * in the phrase `thread-model` already owns ("Thread in General") - the one
 * fact a channel row does not need and the one a reader who arrived from a
 * mention does. Follower counts are deliberately NOT here, though the lobby's
 * thread row prints them: at two facts this row is exactly as dense as the
 * channel rows above and below it, and who is following a tangent is a fact for
 * the room, not for a cross-space triage list.
 *
 * A payload predating the parent-name field simply omits the phrase rather than
 * fetching a parent to name it.
 *
 * ── MUTE SINKS AND DIMS, EXACTLY AS ON A CHANNEL ───────────────────────────
 * `channelUnreadGrammar` reads a thread as it reads a channel, so a muted
 * thread can never go bold and the tone falls back to caught-up ink under the
 * dim. The dim is applied to a WRAPPER around the dimmable parts, never to the
 * anchor: CSS `opacity` composites its whole subtree as one layer, so an
 * anchor-level dim would render the @you badge at 60%, muting the one signal
 * Ruling A guarantees a mute can never suppress. The trailing badge is a
 * SIBLING of the dim wrapper for precisely that reason.
 *
 * `memo` for the reason every row in this feature carries it: the React
 * Compiler's transform is not enabled in this repo, so without it every query
 * transition re-renders the whole list.
 */
export const MyThreadRow = memo(function MyThreadRow({
  thread,
  now,
  index,
  className,
  nested = false,
}: {
  thread: Channel;
  /** Frozen clock — threaded from the screen's lazy `useState` so no
   *  `Date.now()` runs in render (React Compiler lint). */
  now: number;
  /** Position across ALL sections — drives the entrance stagger. */
  index: number;
  /**
   * Extra classes on the row element. The grouped list uses this to indent a
   * thread under its channel heading.
   */
  className?: string;
  /**
   * Drawn UNDERNEATH its channel's heading, rather than as a row in its own
   * right.
   *
   * WHAT THIS TURNS OFF, AND WHY IT IS NOT COSMETIC. A standalone thread row
   * has to say where it came from — the space it lives in, its crest, and
   * "Thread in Product Development" — because nothing else on screen does.
   * Under a heading, all three are the heading, one line above and repeated for
   * every sibling. Left in, they cost the width the TITLE needs: measured on a
   * 390px phone, "Channel/Thread visua..." truncated at 20 characters while the
   * line below it spent the rest of the row saying "Thread in Product Dev...".
   * The reader loses the one thing that tells the rows apart to read the one
   * thing they all share.
   */
  nested?: boolean;
}) {
  const { mentions, muted } = channelUnreadGrammar(thread);
  const state = threadUnreadState(thread);
  // Mute stops the bold and the dot here exactly as it does on a channel row;
  // the tone below then falls back to caught-up ink.
  const behind = state === 'behind' && !muted;
  const title = channelDisplayName(thread);
  const age = formatRelativeTime(thread.last_message_at, now);
  const provenance = threadProvenanceLabel(thread.parent_channel_name);
  const dim = muted
    ? 'opacity-60 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none'
    : undefined;

  return (
    <li
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200',
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 6) * 20}ms` }}
    >
      <Link
        href={`/channels/${thread.uuid}`}
        className={cn(
          'group flex min-w-0 items-start gap-3 rounded-xl px-2 py-3',
          'transition-colors duration-150 hover:bg-secondary/50',
          'motion-reduce:transition-none v2-interactive',
          FOCUS_RING,
        )}
      >
        {/* The dim wrapper — identity only. A `<div>`, not a `<span>`: it holds
            a `MetaLine`, which renders `<div>`s by contract, and a `<div>`
            inside a `<span>` is invalid. An `<a>` accepts flow content, so the
            whole-row link still nests correctly. */}
        <div className={cn('flex min-w-0 flex-1 items-start gap-3', dim)}>
          {nested ? null : (
            <SpaceCrest
              uuid={thread.space.uuid}
              name={thread.space.name}
              type={thread.space.type}
              size="md"
              className="mt-0.5"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {/* `aria-hidden` like the channel row's kind glyph: what this row
                  IS reaches a screen reader as the words "Thread in ..." on the
                  meta line below, which is a sentence rather than a picture. */}
              <GitBranch
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/70"
              />
              {/* A title runs to 120 chars server-side, so the whole of it lives
                  in the tooltip when the row truncates - the courtesy
                  `ThreadsSheet` and `MyChannelRow` extend. */}
              <span
                title={title}
                className={cn(
                  'min-w-0 truncate text-[15px]',
                  'transition-colors duration-150 group-hover:text-primary motion-reduce:transition-none',
                  behind
                    ? 'font-semibold text-foreground'
                    : state === 'none'
                      ? 'font-medium text-muted-foreground'
                      : 'font-medium text-foreground',
                )}
              >
                {title}
              </span>
              {behind ? <UnreadDot /> : null}
              {muted ? (
                <BellOff
                  aria-label="Muted"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              ) : null}
            </div>

            <MetaLine
              className="mt-1"
              lead={
                nested
                  ? [thread.last_message_at === null ? 'No messages yet' : null]
                  : [
                      thread.space.name,
                      provenance,
                      thread.last_message_at === null ? 'No messages yet' : null,
                    ]
              }
            />
          </div>
        </div>

        {/* Sibling of the dim wrapper, so a muted thread's @you stays at full
            strength — the one signal a mute may never quiet. */}
        <div className="mt-1 flex shrink-0 items-center gap-2">
          {mentions > 0 ? (
            <CountBadge
              count={mentions}
              label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${title}`}
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
