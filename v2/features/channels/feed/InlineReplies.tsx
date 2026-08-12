'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CornerDownRight } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { messagesApi } from '@/lib/api/collab';
import { cn } from '@/lib/utils';
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { Message } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { fileCountLabel } from '../model';
import { MemberAvatar } from '../ui/avatars';

/**
 * InlineReplies — the answers to one message, opened in place under it.
 *
 * ── WHY THIS IS AN INDEX AND NOT THE REPLIES THEMSELVES ────────────────────
 * A reply in this product IS a message in the channel. Measured on the live
 * Product Development channel: every reply returned by `/replies` was also in
 * the channel's own message page, and in a quiet channel the reply is usually
 * the very next row. So drawing the replies in full underneath their root would
 * put the same message on screen twice, a few centimetres apart.
 *
 * This draws one line per answer — who, what they said, when — and jumping is
 * the whole interaction. That is the direction `ReplyQuote` already states
 * ("replies are inline quotes, no side threads; Telegram's tap-to-jump"), and
 * an index can never be mistaken for a duplicate because it does not look like
 * a message. It also means a message with 200 answers costs 200 short lines
 * rather than 200 rendered messages.
 *
 * THE SIDE SHEET THIS REPLACED was rejected for sliding a second surface over
 * the room (owner, 2026-08-12: "i prefer it clean in line").
 *
 * ── PAGING, BECAUSE THE COUNT IS UNBOUNDED ─────────────────────────────────
 * `/replies` is PAGE-based and oldest-first, 30 to a page (measured), which is
 * a different shape from the cursor the feed itself uses — do not copy one onto
 * the other. Only the first page is fetched when the reader opens the list; the
 * rest arrive on request, so opening a busy message is never a big download.
 *
 * ── AND IT FETCHES NOTHING UNTIL IT IS OPENED ──────────────────────────────
 * It stays mounted while closed so that both opening AND closing can be a
 * tween rather than a jump-cut (`motion-reduce` honoured by the wrapper in
 * `MessageRow`). `enabled: open` is what keeps that free: a feed full of
 * answered messages issues no requests until somebody actually asks.
 */

/** One line's worth of what a reply says — the same fall-through the reply
 *  quote uses, so a file-only answer reads "2 files" in both places rather
 *  than rendering as an author followed by nothing. */
function replyLineText(message: Message): { text: string; summarised: boolean } {
  const typed = message.content.trim();
  // Collapsed to one line on purpose: an index row is a line, and a pasted
  // paragraph must not be able to set the height of somebody else's feed.
  if (typed !== '') return { text: typed.replace(/\s+/g, ' '), summarised: false };
  const files = message.attachments?.length ?? 0;
  if (files > 0) return { text: fileCountLabel(files), summarised: true };
  return { text: 'Nothing left to show', summarised: true };
}

function ReplyIndexRow({
  reply,
  onJump,
}: {
  reply: Message;
  onJump: (messageUuid: string) => void;
}) {
  const name = reply.is_ai ? 'Lawexa' : (reply.author?.name ?? 'Deleted account');
  const { text, summarised } = replyLineText(reply);

  return (
    <li>
      <button
        type="button"
        onClick={() => onJump(reply.uuid)}
        className={cn(
          'v2-interactive flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left text-xs',
          'transition-colors duration-150 hover:bg-secondary/60 motion-reduce:transition-none',
          FOCUS_RING,
        )}
      >
        {reply.author ? (
          <MemberAvatar user={reply.author} size="sm" />
        ) : (
          <span
            aria-hidden
            className="size-6 shrink-0 rounded-full bg-secondary"
          />
        )}
        <span className="shrink-0 font-medium text-foreground/90">{name}</span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-muted-foreground',
            summarised && 'italic',
          )}
        >
          {text}
        </span>
        <time
          dateTime={reply.created_at}
          title={formatFullTimestamp(reply.created_at)}
          className="shrink-0 text-[11px] text-muted-foreground"
        >
          {formatMessageTime(reply.created_at)}
        </time>
      </button>
    </li>
  );
}

export function InlineReplies({
  channelUuid,
  rootUuid,
  count,
  open,
  regionId,
  onJump,
}: {
  channelUuid: string;
  rootUuid: string;
  /** The feed's own count, used until the list itself can say better. */
  count: number;
  open: boolean;
  regionId: string;
  onJump: (messageUuid: string) => void;
}) {
  const query = useInfiniteQuery({
    queryKey: ['message-replies', channelUuid, rootUuid],
    queryFn: ({ pageParam }) => messagesApi.replies(channelUuid, rootUuid, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.current_page < last.pagination.last_page
        ? last.pagination.current_page + 1
        : undefined,
    enabled: open,
  });

  const replies = query.data?.pages.flatMap((page) => page.data) ?? [];
  // The server's total outranks the feed's `reply_count`, which came from a
  // message list that may be minutes old.
  const total = query.data?.pages[0]?.pagination.total ?? count;
  const remaining = Math.max(0, total - replies.length);

  /**
   * A DISCLOSURE MUST SHOW WHAT IT OPENED, and near the foot of the feed it
   * does not by default: the composer is laid OVER the scrolling area rather
   * than below it (measured — the scroll box runs to the viewport bottom and
   * the composer covers its last ~87px), so answers opened on one of the last
   * messages appear underneath it and pressing looks like it did nothing.
   *
   * `scroll-mb-36` is what keeps that fix honest. The clearance is expressed as
   * the element's own scroll margin, so the browser reserves the room; this row
   * never has to know the composer's height, or that a composer exists. It is
   * deeper than the composer alone needs because the floating "Latest" pill
   * hovers in the same band, and a reveal that lands under the pill is only
   * half a reveal.
   *
   * It runs when the list SETTLES, not when it opens: at open time the rows do
   * not exist yet, so there would be nothing to bring into view. Appending a
   * later page deliberately does not re-run it — `revealed` does not change —
   * because yanking the view while somebody is reading is worse than a button
   * that lands below the fold.
   */
  const containerRef = useRef<HTMLDivElement>(null);
  const revealed = open && !query.isPending;
  useEffect(() => {
    if (!revealed) return;
    containerRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [revealed]);

  return (
    <div
      id={regionId}
      ref={containerRef}
      className="mt-1 scroll-mb-36 border-l border-border/60 pl-2.5"
    >
      {query.isPending ? (
        <div aria-hidden className="space-y-1.5 py-1">
          <Skeleton className="h-6 w-4/5 rounded" />
          <Skeleton className="h-6 w-3/5 rounded" />
        </div>
      ) : query.isError ? (
        <p className="flex flex-wrap items-center gap-x-2 py-1 text-xs text-muted-foreground">
          Couldn&apos;t load the answers.
          <button
            type="button"
            onClick={() => void query.refetch()}
            className={cn('v2-interactive rounded-sm font-medium text-primary underline', FOCUS_RING)}
          >
            Try again
          </button>
        </p>
      ) : replies.length === 0 ? (
        /* Reachable: the count rides a message list that may be seconds old, so
           a reply can be deleted between the feed drawing "1 reply" and this
           asking for it. Deleting a reply leaves the count behind, so the
           honest answer is that there is nothing here now. */
        <p className="py-1 text-xs text-muted-foreground italic">
          No replies now — they may have been deleted.
        </p>
      ) : (
        <>
          <ul>
            {replies.map((reply) => (
              <ReplyIndexRow key={reply.uuid} reply={reply} onJump={onJump} />
            ))}
          </ul>
          {query.hasNextPage && (
            <button
              type="button"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className={cn(
                'v2-interactive mt-0.5 flex items-center gap-1 rounded-sm px-1 py-1 text-xs font-medium',
                'text-primary transition-colors duration-150 hover:bg-primary/10',
                'disabled:opacity-60 motion-reduce:transition-none',
                FOCUS_RING,
              )}
            >
              <CornerDownRight aria-hidden className="size-3.5" />
              {query.isFetchingNextPage
                ? 'Loading…'
                : `Show ${remaining} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
