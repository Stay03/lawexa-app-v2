'use client';

import { FileText } from 'lucide-react';

import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine/types';
import { useStreamingText } from '@/v2/runtime/chat-engine/use-conversation-stream';
import { useV2ChatContext } from '../chat-context';
import { MarkdownText } from '../markdown/MarkdownText';
import { ChatSidePanel } from '../side-panel/ChatSidePanel';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { draftStatus, draftsIn, draftWordsLabel, type DraftBlock } from './draft-blocks';
import { locateDraft } from './draft-ordinals';
import { DraftEditor } from './DraftEditor';

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
 * On a computer the header is the frame's slim line (take B, Stay 24 October
 * 2026): the title and its length in one muted line, with Save as note at its
 * end (DraftEditor.tsx puts it there). The phone sheet keeps its header.
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
      <ChatSidePanel label="Draft" title="Draft" icon={<DraftIcon />} slim>
        <p className="px-5 py-8 text-sm text-muted-foreground">
          This draft is no longer in the chat. Ask Lawexa to write it again.
        </p>
      </ChatSidePanel>
    );
  }

  return (
    <ChatSidePanel
      label="Draft"
      title={draft.title}
      subtitle={
        draft.complete ? (
          <>
            {/* The slim line says only the length: "Draft" is the panel itself. */}
            <span className="xl:hidden">Draft · </span>
            {draftWordsLabel(draft.body)}
          </>
        ) : (
          draftStatus(draft, Boolean(streamingMessage))
        )
      }
      icon={<DraftIcon />}
      slim
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
        <article className="mx-auto w-full max-w-[68ch] px-5 py-6 xl:px-10 xl:pt-7 xl:pb-30">
          <MarkdownText content={draft.body} animate={!draft.complete && Boolean(streamingMessage)} />
        </article>
      )}
    </ChatSidePanel>
  );
}

/** A gold tile on the phone sheet; on a computer, a small icon on the slim line. */
function DraftIcon() {
  return (
    <span
      aria-hidden
      className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary xl:size-auto xl:rounded-none xl:bg-transparent"
    >
      <FileText className="size-[18px] xl:size-3.5" />
    </span>
  );
}
