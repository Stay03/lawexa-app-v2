import { useMemo } from 'react';

import { parseMessageContent } from '@/lib/utils/collab';
import type { MessageMetadata } from '@/types/collab';

interface MessageContentProps {
  content: string;
  /**
   * REQUIRED, and explicitly `null` for resources that carry NO resolved
   * mention list — the AI session transcript returns conversation rows, not
   * messages (`AiTranscriptMessage`). Null renders the text with no chips,
   * because the server's "never guess" rule leaves nothing to resolve. Not
   * optional: forgetting it must fail the build, not silently drop mentions.
   */
  metadata: MessageMetadata | null;
}

/**
 * Renders message text with resolved @mentions highlighted. Whitespace is
 * preserved (`whitespace-pre-wrap`) and long tokens wrap rather than overflow.
 */
export function MessageContent({ content, metadata }: MessageContentProps) {
  const segments = useMemo(
    () =>
      metadata
        ? parseMessageContent(content, metadata)
        : [{ type: 'text' as const, value: content }],
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
