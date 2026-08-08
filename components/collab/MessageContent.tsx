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
        ) : segment.type === 'link' ? (
          // Links became a segment type on 2026-08-08 so an address in a message
          // can be opened by tapping it. Rendered here too, not only in v2:
          // both trees share one parser, and leaving this branch out would have
          // shown v1 readers a URL that still could not be tapped.
          // No `target` on a `mailto:` — see the note in the v2 twin.
          <a
            key={i}
            href={segment.href}
            {...(segment.href.startsWith('mailto:')
              ? {}
              : { target: '_blank', rel: 'noopener noreferrer nofollow' })}
            className="break-all text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {segment.value}
          </a>
        ) : (
          <span key={i}>{segment.value}</span>
        )
      )}
    </div>
  );
}
