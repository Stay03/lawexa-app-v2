'use client';

import type { MessageReplyTo } from '@/types/chat';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { REPLY_UNAVAILABLE, replyAuthorLabel, replySnippet } from '../reply-target';

/**
 * ReplyQuote — the quoted message at the top of a reply's bubble, as WhatsApp
 * draws it (Stay, 14 October 2026): a tinted block with an accent edge, who
 * wrote it and its first lines. A tap scrolls the chat to the original and
 * flashes it. A deleted original keeps the name and says "Message unavailable",
 * and is not a button: there is nothing to go to.
 *
 * Ported from the channel feed's quote (feed/MessageRow.tsx `ReplyQuote`).
 */
export function ReplyQuote({
  replyTo,
  viewerId,
  onJump,
}: {
  replyTo: MessageReplyTo;
  viewerId: number | null;
  /** Scroll to the original; absent where there is no list to scroll (a test render). */
  onJump?: (messageId: number) => void;
}) {
  const name = replyAuthorLabel(replyTo, viewerId);
  const snippet = replySnippet(replyTo);
  const frame =
    'mb-1.5 flex w-full min-w-0 flex-col rounded-xl border-l-[3px] bg-foreground/[0.06] px-3 py-1.5 text-left text-xs dark:bg-foreground/[0.08]';
  const edge = replyTo.role === 'assistant' ? 'border-primary' : 'border-foreground/30';

  if (replyTo.is_unavailable) {
    return (
      <div className={cn(frame, edge)}>
        <span className="font-semibold">{name}</span>
        <span className="text-muted-foreground italic">{REPLY_UNAVAILABLE}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        // The row behind it has its own click (the time on a personal chat).
        event.stopPropagation();
        onJump?.(replyTo.id);
      }}
      className={cn(
        frame,
        edge,
        'v2-interactive transition-colors duration-150 hover:bg-foreground/10 motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      <span className="sr-only">Replying to </span>
      <span className={cn('font-semibold', replyTo.role === 'assistant' && 'text-primary')}>{name}</span>
      <span className="text-muted-foreground line-clamp-2 break-words whitespace-normal">{snippet}</span>
    </button>
  );
}
