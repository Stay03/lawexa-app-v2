'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { isSelfMention, parseMessageContent } from '@/lib/utils/collab';
import type { MessageMetadata } from '@/types/collab';

/**
 * MentionText — a question's words with the people it tags drawn as chips, as
 * the channel feed draws them (feed/MessageContent.tsx): the reader's own tag
 * a little stronger. Only `@handle`s the server resolved become chips; any
 * other `@` stays text (the server's "never guess" rule). Links stay text, as
 * they always have in a question.
 */
export function MentionText({
  content,
  metadata,
  viewerUuid,
}: {
  content: string;
  metadata: MessageMetadata;
  viewerUuid: string | null;
}) {
  const segments = useMemo(() => parseMessageContent(content, metadata), [content, metadata]);
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <span
            key={index}
            title={segment.username && segment.label !== segment.username ? `@${segment.username}` : undefined}
            className={cn(
              'rounded px-1 font-medium',
              isSelfMention(segment.uuid, viewerUuid) ? 'bg-primary/20 text-foreground' : 'bg-primary/10 text-primary',
            )}
          >
            @{segment.label}
          </span>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}
