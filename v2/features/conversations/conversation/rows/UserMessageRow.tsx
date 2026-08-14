'use client';

import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { cn, stripContextTags, parsePastedContent } from '@/lib/utils';
import { formatMessageTimestamp } from '@/lib/utils/date';
import { formatFileSize } from '@/lib/validations/admin-cases';
import type { ChatMessage } from '@/types/chat';
import { PastedContentCard } from '../PastedContentCard';

/**
 * UserMessageRow — v2 port of v1's user message block (§C KEEP). Right-aligned
 * rounded-3xl bubble; content over 1000 chars truncates with a Show more / Show
 * less toggle; a click reveals the timestamp (also shown on hover via the group,
 * so the reveal is reachable on touch too); attachment chips and pasted-content
 * cards below. The inline content-context tags (case/statute/note slugs, radar
 * uuids) are stripped for display, exactly as v1 does.
 */
const USER_MESSAGE_TRUNCATE_LENGTH = 1000;

function UserMessageBubble({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = content.length > USER_MESSAGE_TRUNCATE_LENGTH;

  return (
    <div className="bg-muted text-foreground rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words">
      {shouldTruncate && !expanded ? (
        <div>
          <div className="relative max-h-[200px] overflow-hidden">
            {content.slice(0, USER_MESSAGE_TRUNCATE_LENGTH)}
            <div className="from-muted absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t to-transparent" />
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

export function UserMessageRow({ message }: { message: ChatMessage }) {
  const [showTime, setShowTime] = useState(false);

  const displayContent = stripContextTags(message.content);
  const { pastedTexts, remainingText } = parsePastedContent(displayContent);

  // Prefer the canonical multi-attachment array; fall back to the legacy singular.
  const attachments =
    message.attachments && message.attachments.length > 0
      ? message.attachments
      : message.attachment
        ? [message.attachment]
        : [];

  return (
    <div
      onClick={() => setShowTime((v) => !v)}
      className="group flex flex-col items-end"
    >
      {pastedTexts.length > 0 ? (
        <>
          <div className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
            {pastedTexts.map((text, index) => (
              <PastedContentCard key={index} content={text} />
            ))}
          </div>
          {remainingText && (
            <div className="bg-muted text-foreground mt-1.5 rounded-3xl px-5 py-2.5 whitespace-pre-wrap break-words">
              {remainingText}
            </div>
          )}
        </>
      ) : (
        <UserMessageBubble content={displayContent} />
      )}

      {attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <div
              key={a.file_id}
              className="bg-muted/60 text-muted-foreground flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs"
            >
              <FileUp className="h-3 w-3" />
              <span className="max-w-[150px] truncate">{a.file_name}</span>
              <span>{formatFileSize(a.file_size)}</span>
            </div>
          ))}
        </div>
      )}

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
