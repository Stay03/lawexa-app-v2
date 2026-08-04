'use client';

import { memo } from 'react';
import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatFullTimestamp } from '@/lib/utils/collab';
import type { Message, SlimUser } from '@/types/collab';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { useMinuteNow } from '../use-minute-now';
import { LawexaAvatar, MemberAvatar } from '../ui/avatars';
import { MessageRow, type MessageRowActions } from './MessageRow';

/**
 * MessageGroupRow — one author run (avatar + bold name + quiet relative
 * timestamp once per run; DIRECTION 1: rows not bubbles, two type weights).
 * Phase-5 W2, 2026-08-04.
 *
 * THE APG ARTICLE (design-research DIRECTION 11, acceptance criteria): each
 * group is the feed's `role="article"` unit — `tabIndex={0}`,
 * `aria-posinset`/`aria-setsize` threaded from the feed, labelled by the
 * author + time header. PageUp/Down and Ctrl+Home/End are handled by the
 * feed's delegated keydown (one listener, not one per row).
 *
 * MEMO + NATIVE VIRTUALIZATION: memoised on the group object (stable from
 * the feed's `useMemo` over the messages reference) and, when `virtualize`,
 * carried with `content-visibility: auto` + `contain-intrinsic-size` — the
 * conversation screen's proven pattern (never react-virtual; standards §4
 * correction). The last few groups are exempt so the landing screenful is
 * measured, not estimated.
 *
 * TIMESTAMP: relative in feed via the shared minute clock (only this tiny
 * header re-renders on the tick), exact absolute on hover (`title`) — the
 * house timestamp rule. Muted meta stays on `text-muted-foreground`, the
 * token the a11y bar holds to ≥4.5:1 in both themes.
 */

export const MessageGroupRow = memo(function MessageGroupRow({
  author,
  isAi,
  messages,
  posinset,
  setsize,
  virtualize,
  viewerUuid,
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
  isChannelAdmin: boolean;
  editingUuid: string | null;
  actions: MessageRowActions;
}) {
  const first = messages[0];
  const authorName = isAi ? 'Lawexa' : (author?.name ?? 'Deleted member');

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
      {isAi ? (
        <LawexaAvatar className="mt-0.5 shrink-0" />
      ) : (
        <MemberAvatar user={author} className="mt-0.5 shrink-0" />
      )}
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
              <Sparkles aria-hidden />
              AI
            </Badge>
          )}
          <GroupTime iso={first.created_at} />
        </div>
        <div className="mt-0.5">
          {messages.map((message) => {
            const isMine =
              !!message.author &&
              !!viewerUuid &&
              message.author.uuid === viewerUuid;
            return (
              <MessageRow
                key={message.uuid}
                message={message}
                canEdit={isMine}
                canDelete={isMine || isChannelAdmin}
                viewerUuid={viewerUuid}
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
