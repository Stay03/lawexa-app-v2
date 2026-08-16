'use client';

import { memo } from 'react';
import Link from 'next/link';
import { BellOff, GitBranch } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  channelDisplayName,
  followerLabel,
  threadProvenanceLabel,
} from '@/v2/features/channels/thread-model';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import {
  CountBadge,
  FOCUS_RING,
  UnreadDot,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';
import type { ThreadDigestRow } from './activity-digest';

/**
 * SpaceThreadRow — one THREAD in the space lobby's activity digest, drawn to
 * `SpaceChannelRow`'s exact geometry so the merged list reads as one list:
 * same 36px leading tile, same title size, same trailing cluster, same warm
 * test on the tile. What differs is only what IS different about a thread.
 *
 * ── THE GRAMMAR IS `ThreadsSheet`'s, NOT A NEW ONE ─────────────────────────
 * Title tone follows the three-state thread grammar a reader already learnt
 * under a message: not following is muted ink (a door, not an obligation),
 * caught up is full strength, behind is semibold plus the house gold dot. The
 * gold NUMBER is a mention count and only ever that. The one departure from
 * the sheet's row is the leading tile: there every row is the same kind of
 * object, so a tile said nothing; here the list mixes two kinds, and the
 * branch tile is what tells them apart at a glance - and it keeps the two
 * text columns of the digest on a single left edge.
 *
 * ── THE SECOND LINE IS WHERE IT BRANCHED FROM ──────────────────────────────
 * The one fact a channel row does not need: `parent_channel_name`, in the
 * phrase `thread-model` already owns ("Thread in General"), then who follows
 * it. A payload predating the parent-name field simply leads with the
 * follower count rather than fetching a parent to name it.
 *
 * ── MUTE SINKS AND DIMS, EXACTLY AS ON A CHANNEL ───────────────────────────
 * `grammar` comes from `channelUnreadGrammar` (a thread IS a channel on the
 * wire), so a muted thread can never go bold, and the tone falls back to
 * caught-up ink under the dim. The dim is applied to a WRAPPER around the
 * dimmable parts, never to the anchor: CSS `opacity` composites its whole
 * subtree as one layer, so an anchor-level dim would render the @you badge at
 * 60% - muting the one signal Ruling A guarantees a mute can never suppress.
 * The trailing badge is a SIBLING of the dim wrapper for precisely that
 * reason. Same rule, same shape as `SpaceChannelRow`.
 *
 * `memo` holds because the digest is memoised in `SpaceActivityBlock` and
 * `now` moves once a minute - and it is not decoration: the React Compiler's
 * transform is not enabled in this repo, so without it every query transition
 * above re-renders the whole digest.
 */
export const SpaceThreadRow = memo(function SpaceThreadRow({
  row,
  now,
}: {
  row: ThreadDigestRow;
  /**
   * The shared minute clock. `0` is its pre-hydration value and means "no age
   * yet" - handing it to the formatter would date every row as "now".
   */
  now: number;
}) {
  const { thread, grammar, state } = row;
  const { mentions, muted } = grammar;
  const title = channelDisplayName(thread);
  // Mute stops the bold and the dot here exactly as `channelUnreadGrammar`
  // stops them on a channel row; the tone below falls back to caught-up ink.
  const behind = state === 'behind' && !muted;
  const age = now > 0 ? formatRelativeTime(thread.last_message_at, now) : '';
  const provenance = threadProvenanceLabel(thread.parent_channel_name);
  // SCOPED, NEVER ON THE ANCHOR - see the docblock. The mention badge and the
  // age sit OUTSIDE this wrapper.
  const dim = muted
    ? 'opacity-60 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none'
    : undefined;

  return (
    <li>
      <Link
        href={`/channels/${thread.uuid}`}
        className={cn(
          'group flex min-w-0 items-start gap-3 rounded-xl px-3 py-2.5',
          'transition-colors duration-150 motion-reduce:transition-none v2-interactive',
          'hover:bg-secondary/50',
          FOCUS_RING,
        )}
      >
        {/* `div`s, not `span`s: `MetaLine` renders `div`s by contract and a
            `div` inside a `span` is invalid - the ThreadsSheet rule. An `a`
            accepts flow content, so the whole-row link still nests correctly. */}
        <div className={cn('flex min-w-0 flex-1 items-start gap-3', dim)}>
          <div
            aria-hidden
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
              'transition-colors duration-150 motion-reduce:transition-none',
              // The SAME warm test every other collab row uses, so a
              // muted-with-@you thread stays warm on every surface.
              behind || mentions > 0
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary text-muted-foreground group-hover:text-foreground',
            )}
          >
            <GitBranch className="size-[18px]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {/* A title runs to 120 chars server-side, so the whole of it
                  lives in the tooltip when the row truncates - the courtesy
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
              className="mt-0.5"
              lead={[
                provenance,
                followerLabel(thread.active_members_count),
                thread.last_message_at === null ? 'No messages yet' : null,
              ]}
            />
          </div>
        </div>

        {/* OUTSIDE the dim wrapper, which is the only way it can stay at full
            strength on a muted row (Ruling A's one guaranteed-loud signal). */}
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
