'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatFullTimestamp } from '@/lib/utils/collab';
import type { Message, SlimUser } from '@/types/collab';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { mentionsViewer } from '../model';
import { useMinuteNow } from '../use-minute-now';
import { LawexaAvatar, LawexaMark, MemberAvatar } from '../ui/avatars';
import { MessageRow, type MessageRowActions } from './MessageRow';

/**
 * MessageGroupRow — one author run (avatar + bold name + quiet relative
 * timestamp once per run; DIRECTION 1: rows not bubbles, two type weights).
 * Phase-5 W2; the continuity rail and the per-row gutter times are the W2
 * redesign wave, 2026-08-05.
 *
 * ── THE CONTINUITY RAIL ────────────────────────────────────────────────────
 * A run of six messages from one person was six independent lines under one
 * header: nothing on screen said where the run began or ended, so a reader
 * scrolling into the middle of it had to travel upward to find out who was
 * talking. A hairline dropped from the avatar down the length of the run makes
 * it ONE object — the cheapest possible piece of structure, costing a single
 * pixel of width and no vertical space at all.
 *
 * It is drawn only for runs of two or more: a one-message run would show a
 * 2px stub, which is noise pretending to be structure.
 *
 * IT WARMS TO GOLD WHEN THE RUN NAMES YOU. The self-mention wash already tints
 * the message itself, but the wash is inside the run and invisible from a
 * distance; the rail is the run's edge, so a mention anywhere in it is legible
 * in peripheral vision while scrolling past. Gold still means exactly one
 * thing — this concerns you — and the rail carries no other state.
 *
 * ── THE APG ARTICLE (DIRECTION 11, acceptance criteria) ────────────────────
 * Each group is the feed's `role="article"` unit — `tabIndex={0}`,
 * `aria-posinset`/`aria-setsize` threaded from the feed, labelled by the
 * author. PageUp/Down and Ctrl+Home/End are handled by the feed's delegated
 * keydown (one listener, not one per row).
 *
 * MEMO + NATIVE VIRTUALIZATION: memoised on the group object (stable from the
 * feed's `useMemo` over the messages reference) and, when `virtualize`,
 * carried with `content-visibility: auto` + `contain-intrinsic-size` — the
 * conversation screen's proven pattern (never react-virtual; standards §4
 * correction). The last few groups are exempt so the landing screenful is
 * measured, not estimated.
 *
 * TIMESTAMP: relative in feed via the shared minute clock (only this tiny
 * header re-renders on the tick), exact absolute on hover (`title`). Every
 * message AFTER the first also carries its own clock time in the left gutter,
 * revealed on row hover — see {@link MessageRow} — so any line in a long run
 * can be dated without counting down from the header.
 */

export const MessageGroupRow = memo(function MessageGroupRow({
  author,
  isAi,
  messages,
  posinset,
  setsize,
  virtualize,
  viewerUuid,
  canEngage,
  isChannelAdmin,
  editingUuid,
  actions,
}: {
  author: SlimUser | null;
  isAi: boolean;
  messages: readonly Message[];
  posinset: number;
  setsize: number;
  virtualize: boolean;
  viewerUuid: string | null;
  /** False in the feed's read-only mode — a plain boolean rather than the
   *  access object, so the row's `memo` still holds across re-renders. */
  canEngage: boolean;
  isChannelAdmin: boolean;
  editingUuid: string | null;
  actions: MessageRowActions;
}) {
  const first = messages[0];
  const authorName = isAi ? 'Lawexa' : (author?.name ?? 'Deleted member');
  const run = messages.length > 1;
  const namesViewer = messages.some((message) =>
    mentionsViewer(message.metadata.mentions, viewerUuid),
  );

  return (
    <article
      tabIndex={0}
      aria-posinset={posinset}
      aria-setsize={setsize}
      aria-label={authorName}
      data-feed-article
      style={
        virtualize
          ? ({ contentVisibility: 'auto', containIntrinsicSize: 'auto 96px' } as const)
          : undefined
      }
      // The article is a keyboard traversal stop (PageUp/Down), so it needs
      // a VISIBLE focus indicator — the house gold ring, never a bare
      // outline-none (audit H2/WCAG 2.4.7).
      className={cn('flex gap-3 rounded-md px-1', FOCUS_RING)}
    >
      {/* The author column: the mark, then the run's own edge. */}
      <div className="flex w-8 shrink-0 flex-col items-center">
        {isAi ? (
          <LawexaAvatar className="mt-0.5" />
        ) : (
          <MemberAvatar user={author} className="mt-0.5" />
        )}
        {run && (
          <span
            aria-hidden
            className={cn(
              'mt-1 mb-0.5 w-px flex-1 rounded-full',
              namesViewer ? 'bg-primary/50' : 'bg-border',
            )}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-sm font-semibold',
              !isAi && !author && 'text-muted-foreground',
            )}
          >
            {authorName}
          </span>
          {isAi && (
            <Badge
              variant="secondary"
              className="h-4 gap-0.5 px-1.5 text-[10px] font-medium [&>svg]:size-2.5!"
            >
              <LawexaMark className="size-2.5" />
              AI
            </Badge>
          )}
          <GroupTime iso={first.created_at} />
        </div>
        <div className="mt-0.5">
          {messages.map((message, index) => {
            const isMine =
              !!message.author &&
              !!viewerUuid &&
              message.author.uuid === viewerUuid;
            return (
              <MessageRow
                key={message.uuid}
                message={message}
                canEngage={canEngage}
                isMine={isMine}
                canDelete={isMine || isChannelAdmin}
                viewerUuid={viewerUuid}
                // The run's head is already dated by the header above it; a
                // second time on the same line would be the same fact twice.
                showGutterTime={index > 0}
                editing={editingUuid === message.uuid}
                actions={actions}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
});

/** The run's relative age — isolated so the minute tick re-renders ONLY this
 *  span, never the memoised rows around it. Empty until the clock hydrates
 *  (SSR renders no relative age; the hover title carries the exact moment). */
function GroupTime({ iso }: { iso: string }) {
  const now = useMinuteNow();
  const relative = now > 0 ? formatRelativeTime(iso, now) : '';
  return (
    <time
      dateTime={iso}
      title={formatFullTimestamp(iso)}
      className="text-xs text-muted-foreground"
    >
      {relative && (relative === 'now' ? 'just now' : `${relative} ago`)}
    </time>
  );
}
