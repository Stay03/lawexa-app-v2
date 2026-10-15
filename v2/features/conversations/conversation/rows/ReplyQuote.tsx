'use client';

import type { MessageReplyTo } from '@/types/chat';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { REPLY_UNAVAILABLE, replyAuthorLabel, replySnippet, type QuoteTone } from '../reply-target';
import { QuoteFrame } from './QuoteFrame';

/**
 * ReplyQuote — the quoted message at the top of a reply's bubble, as WhatsApp
 * draws it (Stay, 14 and 15 October 2026): a tinted rounded block with a
 * straight bar on its left in the quoted person's colour (QuoteFrame), who
 * wrote it and its first lines. A tap scrolls the chat to the original and
 * flashes it. A deleted original keeps the name and says "Message
 * unavailable", and is not a button: there is nothing to go to.
 *
 * Ported from the channel feed's quote (feed/MessageRow.tsx `ReplyQuote`).
 */
export function ReplyQuote({
  replyTo,
  viewerId,
  tone,
  onJump,
}: {
  replyTo: MessageReplyTo;
  viewerId: number | null;
  /** The quoted person's colour (reply-target.ts `quoteTone`). */
  tone: QuoteTone;
  /** Scroll to the original; absent where there is no list to scroll (a test render). */
  onJump?: (messageId: number) => void;
}) {
  const name = replyAuthorLabel(replyTo, viewerId);
  const ground = 'mb-1.5 block w-full rounded-xl bg-foreground/[0.06] dark:bg-foreground/[0.08]';

  if (replyTo.is_unavailable) {
    return (
      <div className={ground}>
        <QuoteFrame tone={tone} name={name}>
          <span className="text-muted-foreground italic">{REPLY_UNAVAILABLE}</span>
        </QuoteFrame>
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
        ground,
        'v2-interactive text-left transition-colors duration-150 hover:bg-foreground/10 motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      <span className="sr-only">Replying to </span>
      <QuoteFrame tone={tone} name={name}>
        <span className="text-muted-foreground line-clamp-2 break-words whitespace-normal">{replySnippet(replyTo)}</span>
      </QuoteFrame>
    </button>
  );
}
