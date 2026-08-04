import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { parseMessageContent } from '@/lib/utils/collab';
import type { MessageMetadata } from '@/types/collab';

/**
 * MessageContent — message text with resolved @mentions highlighted. Only
 * handles the server actually resolved (`metadata.mentions`, plus `@lawexa`
 * when `lawexa_mentioned`) light up; unresolved `@tokens` stay plain text —
 * the server's "never guess" rule (digest §F.15). The parser is the pure
 * `lib/utils/collab.ts` one (sanctioned utils layer — one source of truth
 * with v1, not a fork).
 *
 * A mention OF THE VIEWER renders stronger (gold fill, readable text) than a
 * mention of someone else (quiet gold tint) — the self-mention emphasis the
 * audit found missing in v1 (§8 item 6; design-research DIRECTION 2).
 *
 * W3 SEAM — LAWEXA MARKDOWN: AI messages flow through this same plain-text
 * path in W2. W3 ports the markdown renderer (`LawexaMessageContent`) and
 * branches on `is_ai` at the ROW, not here — this component stays the one
 * human-text renderer either way.
 */
/** One definition of human body text, shared by both entry points below. */
const BODY_CLASS =
  'text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-foreground';

export function MessageContent({
  content,
  metadata,
  viewerUuid,
}: {
  content: string;
  metadata: MessageMetadata;
  /** For the self-mention emphasis; `null` mutes the distinction. */
  viewerUuid: string | null;
}) {
  const segments = useMemo(
    () => parseMessageContent(content, metadata),
    [content, metadata],
  );

  const selfNames = useMemo(() => {
    if (!viewerUuid) return new Set<string>();
    // Same rule as `buildMentionHandleMap`: a payload without `mentions`
    // degrades to "nobody was mentioned", it never takes the feed down.
    return new Set(
      (metadata.mentions ?? [])
        .filter((mention) => mention.uuid === viewerUuid)
        .map((mention) => mention.name),
    );
  }, [metadata.mentions, viewerUuid]);

  return (
    <div className={BODY_CLASS}>
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <span
            key={index}
            className={cn(
              'rounded px-1 font-medium',
              selfNames.has(segment.label)
                ? 'bg-primary/20 text-foreground'
                : 'bg-primary/10 text-primary',
            )}
          >
            @{segment.label}
          </span>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </div>
  );
}

/**
 * The same body text for a resource that carries NO resolved mention list — the
 * AI session transcript, whose rows are conversation rows rather than messages
 * (`AiTranscriptMessage`). Nothing is parsed, because the server's "never
 * guess" rule leaves nothing to resolve: every `@token` is literal text.
 */
export function PlainMessageContent({ content }: { content: string }) {
  return <div className={BODY_CLASS}>{content}</div>;
}
