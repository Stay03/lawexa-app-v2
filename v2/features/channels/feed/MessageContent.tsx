import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { isSelfMention, parseMessageContent } from '@/lib/utils/collab';
import type { MessageMetadata } from '@/types/collab';

/**
 * MessageContent — message text with resolved @mentions highlighted. Only
 * handles the server actually resolved (`metadata.mentions`, plus `@lawexa`
 * when `lawexa_mentioned`) light up; unresolved `@tokens` stay plain text —
 * the server's "never guess" rule (digest §F.19). The parser is the pure
 * `lib/utils/collab.ts` one (sanctioned utils layer — one source of truth
 * with v1, not a fork).
 *
 * A mention OF THE VIEWER renders stronger (gold fill, readable text) than a
 * mention of someone else (quiet gold tint) — the self-mention emphasis the
 * audit found missing in v1 (§8 item 6; design-research DIRECTION 2).
 *
 * "OF THE VIEWER" IS DECIDED BY UUID, NOT BY NAME. This compared display-name
 * strings until 2026-08-05, so two members called "Ada Obi" both lit up when
 * either was named — the ambiguity usernames exist to end, reproduced in the
 * one place it is most personal.
 *
 * THE CHIP SHOWS THE DISPLAY NAME — UNLESS THE NAME IS CONTESTED. The writer
 * typed `@adaobi2`; the reader sees `@Ada Obi`, because our username is a
 * lookup key rather than a public identity (generated, never chosen, absent
 * everywhere a person is merely speaking — Discord's split, and the backend's
 * own when it left notification previews reading "@Ada Obi"). But when ONE
 * message tags two different people who share a name, the name has failed at
 * its only job, and `buildMentionChips` swaps that chip's text for the handle.
 * That is the disambiguation, and it is TEXT — a `title` tooltip would answer
 * a mouse and leave every phone reader exactly where they started. The title
 * stays as a pointer convenience, never as the mechanism.
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

  return (
    <div className={BODY_CLASS}>
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <span
            key={index}
            // Nothing to add when the chip already IS the handle (a contested
            // name) — a tooltip repeating the text under the cursor is noise.
            title={
              segment.username && segment.label !== segment.username
                ? `@${segment.username}`
                : undefined
            }
            className={cn(
              'rounded px-1 font-medium',
              isSelfMention(segment.uuid, viewerUuid)
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
