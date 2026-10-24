'use client';

import { FileText } from 'lucide-react';

import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine/types';
import { useStreamingText } from '@/v2/runtime/chat-engine/use-conversation-stream';
import { useV2ChatContext } from '../chat-context';
import { MarkdownText } from '../markdown/MarkdownText';
import { ChatSidePanel } from '../side-panel/ChatSidePanel';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { draftStatus, draftsIn, type DraftBlock } from './draft-blocks';
import { locateDraft } from './draft-ordinals';
import { DRAFT_DOCUMENT, DraftBar, DraftEditor } from './DraftEditor';

/**
 * DraftPanel — draft N of this chat in the side panel (`?side=draft:N`).
 *
 * It finds the draft by its place (draft-ordinals.ts): in a saved answer's
 * text, or, past them, in the answer still streaming, read live so the panel
 * shows the draft as it is written. A draft that is no longer in the chat (an
 * old link, a regenerated answer) says so rather than showing another.
 *
 * While Lawexa is still writing it, the draft reads as it arrives. Once it
 * is finished it opens in the editor (DraftEditor.tsx): the reader edits it
 * with the note editor's controls, font type and size included, and saves it
 * as a note.
 *
 * On a computer the panel is `bare` (take B2, Stay 24 October 2026): no title
 * and no word count, which the chat's draft card already shows; the panel
 * starts with its one bar (DraftEditor.tsx), and while the draft is written
 * that bar holds only the close. The phone sheet keeps its header.
 */
export function DraftPanel({
  ordinal,
  messages,
  streamingText,
}: {
  ordinal: number;
  messages: readonly EngineMessage[];
  streamingText: StreamingSource;
}) {
  const place = locateDraft(messages, ordinal);
  const streamingMessage = 'streamingIndex' in place ? messages.findLast((message) => message.isStreaming) : undefined;
  const live = useStreamingText(streamingText, streamingMessage?.id ?? '');
  const conversationId = useV2ChatContext()?.conversationId;
  const space = useSidePanel()?.space ?? null;

  let draft: DraftBlock | null = null;
  if ('messageId' in place) {
    const message = messages.find((candidate) => candidate.id === place.messageId);
    draft = message ? (draftsIn(message.content)[place.index] ?? null) : null;
  } else if (streamingMessage) {
    draft = draftsIn(live, true)[place.streamingIndex] ?? null;
  }

  if (!draft) {
    return (
      <ChatSidePanel label="Draft" title="Draft" icon={<DraftIcon />} bare>
        <DraftBar />
        <p className="px-5 py-8 text-sm text-muted-foreground xl:px-12">
          This draft is no longer in the chat. Ask Lawexa to write it again.
        </p>
      </ChatSidePanel>
    );
  }

  return (
    <ChatSidePanel
      label="Draft"
      title={draft.title}
      subtitle={draftStatus(draft, Boolean(streamingMessage))}
      icon={<DraftIcon />}
      bare
    >
      {draft.complete && conversationId ? (
        <DraftEditor
          conversationId={conversationId}
          ordinal={ordinal}
          title={draft.title}
          markdown={draft.body}
          font={{ font: draft.font, size: draft.size }}
          space={space}
        />
      ) : (
        <div className="@container/draft">
          <DraftBar />
          <article className={DRAFT_DOCUMENT}>
            <MarkdownText content={draft.body} animate={!draft.complete && Boolean(streamingMessage)} />
          </article>
        </div>
      )}
    </ChatSidePanel>
  );
}

function DraftIcon() {
  return (
    <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
      <FileText className="size-[18px]" />
    </span>
  );
}
