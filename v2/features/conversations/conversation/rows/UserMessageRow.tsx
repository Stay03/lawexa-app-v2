'use client';

import { useMemo, useState } from 'react';
import { cn, stripContextTags, parsePastedContent } from '@/lib/utils';
import { formatMessageTimestamp } from '@/lib/utils/date';
import type { ChatMessage, MessageReplyTo } from '@/types/chat';
import type { MessageMetadata } from '@/types/collab';
import { PastedContentCard } from '../PastedContentCard';
import { memberStyle } from '../member-colour';
import { mentionMetadata, spaceUnmatchedSentence } from '../mention-options';
import { replyAuthorLabel, replyTargetOf, type QuoteTone } from '../reply-target';
import { turnSide } from '../space-turn';
import { HoverReply } from './HoverReply';
import { MentionText } from './MentionText';
import { ReplyQuote } from './ReplyQuote';
import { SentAttachments } from './SentAttachments';
import { SpaceTurn } from './SpaceTurn';
import { SwipeToReply } from './SwipeToReply';
import type { HeldTurn } from './TurnActionsSheet';

/**
 * UserMessageRow — v2 port of v1's user message block (§C KEEP). Right-aligned
 * rounded-3xl bubble; content over 1000 chars truncates with a Show more / Show
 * less toggle; a click reveals the timestamp (also shown on hover via the group,
 * so the reveal is reachable on touch too); the sent files ({@link
 * SentAttachments}) and pasted-content cards below. The inline content-context
 * tags (case/statute/note slugs, radar uuids) are stripped for display, exactly
 * as v1 does.
 *
 * In a space chat the row is laid out as Arthur drew it ({@link SpaceTurn}): the
 * reader's own question on the right with "You · 10:36 AM", everyone else's
 * on the left with their crest, name and time. A personal chat keeps the
 * layout above, unchanged.
 *
 * A reply carries its quote at the top of the bubble ({@link ReplyQuote}). In a
 * space chat where the reader may send, a saved question can be replied to:
 * Reply on hover for a mouse, a swipe to the right or a long press (the actions
 * sheet) on a touch screen (Stay, 14 October 2026: "like how whatsapp replies are").
 *
 * The people a question tags show as chips ({@link MentionText}), and the
 * writer's own question says which `@`s matched nobody in the space.
 */
const USER_MESSAGE_TRUNCATE_LENGTH = 1000;

/**
 * The marker the server writes into a message for each file it attached:
 * `<attached_image name="a1.png" />`, or `<attached_document name="scan.pdf"
 * pages_as_images="1" />` for a scan sent as pages. The message resource
 * removes only the paired `<attached_document>…</attached_document>` form, so
 * these single tags reached the bubble as text (seen 24 September 2026). The
 * files already show under the bubble, so the markers are removed here, and
 * only on a message that has files, which is when the server writes them.
 */
const ATTACHMENT_MARKER = /\s*<attached_(?:image|document)\b[^>]*\/>/g;

/** A colour that arrives late (the space's roster answering after the
 *  transcript, on a first open) eases in rather than popping. */
const COLOUR_EASE = 'transition-colors duration-300 motion-reduce:transition-none';

/** The bubble's ground: the member's colour in a space chat (the row sets the
 *  `--member-*` properties), else the plain muted one. */
const BUBBLE_GROUND = {
  plain: cn('bg-muted', COLOUR_EASE),
  member: cn('bg-[var(--member-bg)] dark:bg-[var(--member-bg-dark)]', COLOUR_EASE),
} as const;
const FADE_GROUND = {
  plain: 'from-muted',
  member: 'from-[var(--member-bg)] dark:from-[var(--member-bg-dark)]',
} as const;

function UserMessageBubble({
  content,
  tint,
  quote = null,
  mentions = null,
  viewerUuid = null,
}: {
  content: string;
  tint: 'plain' | 'member';
  /** The quoted message of a reply, drawn at the top of the bubble. */
  quote?: React.ReactNode;
  /** The people the question tags, as chips; null draws the plain text. */
  mentions?: MessageMetadata | null;
  viewerUuid?: string | null;
}) {
  const words = (text: string) =>
    mentions ? <MentionText content={text} metadata={mentions} viewerUuid={viewerUuid} /> : text;
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = content.length > USER_MESSAGE_TRUNCATE_LENGTH;

  return (
    <div className={cn(BUBBLE_GROUND[tint], 'text-foreground rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words', quote !== null && 'pt-2')}>
      {quote !== null && <div className="-mx-2.5 min-w-0">{quote}</div>}
      {shouldTruncate && !expanded ? (
        <div>
          <div className="relative max-h-[200px] overflow-hidden">
            {words(content.slice(0, USER_MESSAGE_TRUNCATE_LENGTH))}
            <div className={cn(FADE_GROUND[tint], 'absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t to-transparent')} />
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="text-muted-foreground hover:text-foreground mt-1 text-xs"
          >
            Show more
          </button>
        </div>
      ) : (
        <div>
          {words(content)}
          {shouldTruncate && (
            <button
              onClick={() => setExpanded(false)}
              className="text-muted-foreground hover:text-foreground mt-1 block text-xs"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function UserMessageRow({
  message,
  showAuthor,
  viewerId,
  viewerUuid = null,
  colourIndex = null,
  quoteTone = 'plain',
  onReply = null,
  onJump,
  onHold,
}: {
  message: ChatMessage;
  /** A space chat on a server with B4: name who asked (space-turn.ts). */
  showAuthor: boolean;
  /** The server-verified viewer, whose own turns read "You". */
  viewerId: number | null;
  /** The reader's uuid, for their own tag's emphasis. */
  viewerUuid?: string | null;
  /** The asker's colour in a space chat (member-colour.ts); null keeps the
   *  plain bubble, as on a personal chat. */
  colourIndex?: number | null;
  /** The colour of the message this one quotes (reply-target.ts `quoteTone`). */
  quoteTone?: QuoteTone;
  /** Make this question the reply target; null where the reader cannot reply. */
  onReply?: ((target: MessageReplyTo) => void) | null;
  /** Scroll to a quoted message and flash it. */
  onJump?: (messageId: number) => void;
  /** Open the actions sheet for this question (a long press). */
  onHold?: (held: HeldTurn) => void;
}) {
  const [showTime, setShowTime] = useState(false);
  const tint = colourIndex === null ? 'plain' : 'member';

  const hasFiles = (message.attachments?.length ?? 0) > 0 || message.attachment !== undefined;
  const displayContent = stripContextTags(
    hasFiles ? message.content.replace(ATTACHMENT_MARKER, '') : message.content,
  );
  const { pastedTexts, remainingText } = parsePastedContent(displayContent);

  // Prefer the canonical multi-attachment array; fall back to the legacy singular.
  const attachments =
    message.attachments && message.attachments.length > 0
      ? message.attachments
      : message.attachment
        ? [message.attachment]
        : [];

  const mentions = useMemo(() => mentionMetadata(message.mentions), [message.mentions]);
  const unmatched = message.unmatchedHandles ? spaceUnmatchedSentence(message.unmatchedHandles) : '';
  const quote = message.replyTo ? (
    <ReplyQuote replyTo={message.replyTo} viewerId={viewerId} tone={quoteTone} onJump={onJump} />
  ) : null;

  if (showAuthor) {
    // Only a saved question can be replied to (replyTargetOf).
    const target = onReply ? replyTargetOf(message) : null;
    const reply = target && onReply ? () => onReply(target) : null;
    const content = (
      <>
        {pastedTexts.length > 0 ? (
          <>
            <div data-v2-strip="" className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
              {pastedTexts.map((text, index) => (
                <PastedContentCard key={index} content={text} />
              ))}
            </div>
            {remainingText && (
              <div className={cn(BUBBLE_GROUND[tint], 'text-foreground mt-1.5 rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words')}>
                {quote !== null && <div className="-mx-2.5 min-w-0">{quote}</div>}
                {mentions ? (
                  <MentionText content={remainingText} metadata={mentions} viewerUuid={viewerUuid} />
                ) : (
                  remainingText
                )}
              </div>
            )}
          </>
        ) : (
          <UserMessageBubble
            content={displayContent}
            tint={tint}
            quote={quote}
            mentions={mentions}
            viewerUuid={viewerUuid}
          />
        )}
        {attachments.length > 0 && <SentAttachments attachments={attachments} />}
        {unmatched && <p className="text-muted-foreground mt-1 text-xs">{unmatched}</p>}
      </>
    );
    return (
      <SwipeToReply
        onReply={reply}
        onLongPress={
          target && onHold
            ? () => onHold({ target, content: displayContent, label: replyAuthorLabel(target, viewerId) })
            : undefined
        }
      >
        <SpaceTurn
          side={turnSide(message, viewerId)}
          author={message.author ?? null}
          time={message.timestamp}
          colourIndex={colourIndex}
          action={reply ? <HoverReply onClick={reply} /> : null}
        >
          {content}
        </SpaceTurn>
      </SwipeToReply>
    );
  }

  return (
    <div
      onClick={() => setShowTime((v) => !v)}
      className="group flex flex-col items-end"
      style={colourIndex === null ? undefined : memberStyle(colourIndex)}
    >
      {pastedTexts.length > 0 ? (
        <>
          <div data-v2-strip="" className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
            {pastedTexts.map((text, index) => (
              <PastedContentCard key={index} content={text} />
            ))}
          </div>
          {remainingText && (
            <div className={cn(BUBBLE_GROUND[tint], 'text-foreground mt-1.5 rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words')}>
              {quote !== null && <div className="-mx-2.5 min-w-0">{quote}</div>}
              {remainingText}
            </div>
          )}
        </>
      ) : (
        <UserMessageBubble content={displayContent} tint={tint} quote={quote} />
      )}

      {attachments.length > 0 && <SentAttachments attachments={attachments} />}

      <div
        className={cn(
          'text-muted-foreground mt-1.5 select-none text-xs transition-opacity',
          showTime ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {formatMessageTimestamp(message.timestamp)}
      </div>
    </div>
  );
}
