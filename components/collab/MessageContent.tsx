import { useMemo } from 'react';

import { parseMessageContent } from '@/lib/utils/collab';
import type { MessageMetadata } from '@/types/collab';

interface MessageContentProps {
  content: string;
  metadata: MessageMetadata;
}

/**
 * Renders message text with resolved @mentions highlighted. Whitespace is
 * preserved (`whitespace-pre-wrap`) and long tokens wrap rather than overflow.
 */
export function MessageContent({ content, metadata }: MessageContentProps) {
  const segments = useMemo(
    () => parseMessageContent(content, metadata),
    [content, metadata]
  );

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
      {segments.map((segment, i) =>
        segment.type === 'mention' ? (
          <span
            key={i}
            className="rounded bg-primary/10 px-1 font-medium text-primary"
          >
            @{segment.label}
          </span>
        ) : (
          <span key={i}>{segment.value}</span>
        )
      )}
    </div>
  );
}
