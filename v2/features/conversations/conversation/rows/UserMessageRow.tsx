'use client';

import { useState } from 'react';
import { cn, stripContextTags, parsePastedContent } from '@/lib/utils';
import { formatMessageTimestamp } from '@/lib/utils/date';
import type { ChatMessage } from '@/types/chat';
import { PastedContentCard } from '../PastedContentCard';
import { memberStyle } from '../member-colour';
import { turnSide } from '../space-turn';
import { SentAttachments } from './SentAttachments';
import { SpaceTurn } from './SpaceTurn';

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

function UserMessageBubble({ content, tint }: { content: string; tint: 'plain' | 'member' }) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = content.length > USER_MESSAGE_TRUNCATE_LENGTH;

  return (
    <div className={cn(BUBBLE_GROUND[tint], 'text-foreground rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words')}>
      {shouldTruncate && !expanded ? (
        <div>
          <div className="relative max-h-[200px] overflow-hidden">
            {content.slice(0, USER_MESSAGE_TRUNCATE_LENGTH)}
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
          {content}
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
  colourIndex = null,
}: {
  message: ChatMessage;
  /** A space chat on a server with B4: name who asked (space-turn.ts). */
  showAuthor: boolean;
  /** The server-verified viewer, whose own turns read "You". */
  viewerId: number | null;
  /** The asker's colour in a space chat (member-colour.ts); null keeps the
   *  plain bubble, as on a personal chat. */
  colourIndex?: number | null;
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

  if (showAuthor) {
    const content = (
      <>
        {pastedTexts.length > 0 ? (
          <>
            <div className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
              {pastedTexts.map((text, index) => (
                <PastedContentCard key={index} content={text} />
              ))}
            </div>
            {remainingText && (
              <div className={cn(BUBBLE_GROUND[tint], 'text-foreground mt-1.5 rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words')}>
                {remainingText}
              </div>
            )}
          </>
        ) : (
          <UserMessageBubble content={displayContent} tint={tint} />
        )}
        {attachments.length > 0 && <SentAttachments attachments={attachments} />}
      </>
    );
    return (
      <SpaceTurn
        side={turnSide(message.author, viewerId)}
        author={message.author ?? null}
        time={message.timestamp}
        colourIndex={colourIndex}
      >
        {content}
      </SpaceTurn>
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
          <div className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
            {pastedTexts.map((text, index) => (
              <PastedContentCard key={index} content={text} />
            ))}
          </div>
          {remainingText && (
            <div className={cn(BUBBLE_GROUND[tint], 'text-foreground mt-1.5 rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words')}>
              {remainingText}
            </div>
          )}
        </>
      ) : (
        <UserMessageBubble content={displayContent} tint={tint} />
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
