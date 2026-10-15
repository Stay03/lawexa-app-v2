'use client';

import { memo } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { Space } from '@/types/collab';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import {
  CountBadge,
  FOCUS_RING,
  UnreadDot,
  formatRelativeTime,
} from '@/v2/shell/designs/modules';
import { lastMessageLine, spaceUnreadGrammar } from '../model';
import { spaceIsPrivate } from './list-rows';

/**
 * SpaceRow — one space in the spaces list, read like a chat list (Stay, 15
 * October 2026).
 *
 * ── THE ANATOMY ────────────────────────────────────────────────────────────
 *   [ crest 48 ]  name • [ mentions ]                 Private · Study
 *                 Ada Obi: Can a tenant withhold rent?            2h
 *
 * Stay found the old lane "very messy": a role line, a kind box, a lock,
 * channel chips, content counts, faces and a member count. Now:
 *  - Line 1 is the name (it truncates), the unread grammar right after it (the
 *    bold name, the gold dot, the gold mention number: `spaceUnreadGrammar`,
 *    unchanged), and at the top right, in the same place on every row,
 *    "Private" in violet or "Public" in green, then "· Work" or "· Study"
 *    (Stay: "write them in text and put them on the top right … it gets
 *    uniformity"; an icon pair came first and was turned down).
 *  - Line 2 is the newest message in the space and who sent it, with its time
 *    at the right of that line ("the time stays by the side of the message like
 *    how that usually is"): "Name: preview", "You: …", "Lawexa: …"
 *    (`lastMessageLine`, the same words a space's own chat rows use). A space
 *    with no message says so, muted.
 *  - Whose space it is lives in the list's sections ("Your spaces", "Joined"),
 *    not on the row; the members are in the space's People tab.
 *
 * THE TIME IS RELATIVE ("2h", "3d"): a clock time would be printed in the
 * server's timezone on the first render and the reader's after it, and React
 * refuses a mismatched hydration. `showTime` turns it off in one place.
 */
export const SpaceRow = memo(function SpaceRow({
  space,
  now,
  index,
  viewerUuid,
  showTime = true,
}: {
  space: Space;
  /** Frozen clock for the relative age (React Compiler lint). */
  now: number;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** "You:" on the message line when the reader sent it. */
  viewerUuid: string | null;
  /** The newest message's time at the right of line 2. */
  showTime?: boolean;
}) {
  const { unread, mentions } = spaceUnreadGrammar(space);
  const latest = space.latest_message ?? null;
  const line = lastMessageLine(latest, viewerUuid);
  const age = showTime && latest ? formatRelativeTime(latest.created_at, now) : '';
  const isPrivate = spaceIsPrivate(space);

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
        {/* No Work/Study corner mark: the row says it in words at the top right. */}
        <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="lg" noMark />

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
            {mentions > 0 ? (
              <CountBadge
                count={mentions}
                label={`${mentions} unread ${mentions === 1 ? 'mention' : 'mentions'} in ${space.name}`}
              />
            ) : null}
            {/* The same place on every row (Stay: "put them on the top right
                cos that's wasted space and it gets uniformity"). */}
            <span className="ml-auto shrink-0 pl-2 text-xs">
              <span
                className={cn(
                  'font-semibold',
                  isPrivate
                    ? 'text-violet-600 dark:text-violet-300'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {isPrivate ? 'Private' : 'Public'}
              </span>
              <span className="text-muted-foreground"> · {space.type_label}</span>
            </span>
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-2 text-[13px]">
            {line ? (
              <span className={cn('min-w-0 flex-1 truncate', unread ? 'text-foreground' : 'text-muted-foreground')}>
                {line}
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate italic text-muted-foreground">No messages yet</span>
            )}
            {age ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{age}</span> : null}
          </div>
        </div>
      </Link>
    </li>
  );
});
