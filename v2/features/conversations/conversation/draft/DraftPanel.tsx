'use client';

import { FileText } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine/types';
import { useStreamingText } from '@/v2/runtime/chat-engine/use-conversation-stream';
import { useV2ChatContext } from '../chat-context';
import { MarkdownText } from '../markdown/MarkdownText';
import { ChatSidePanel } from '../side-panel/ChatSidePanel';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { draftStatus, draftsIn, type DraftBlock } from './draft-blocks';
import { locateDraft } from './draft-ordinals';
import { DRAFT_DOCUMENT, DraftBar, DraftEditor } from './DraftEditor';
import { draftGroupKey, draftVersionTitle } from './draft-versions';
import { DraftVersionSwitch } from './DraftVersionSwitch';

/**
 * DraftPanel — draft N of this chat in the side panel (`?side=draft:N`).
 *
 * It finds the draft by its place (draft-ordinals.ts): in a saved answer's
 * text, or, past them, in the answer still streaming, read live so the panel
 * shows the draft as it is written. A draft that is no longer in the chat (an
 * old link, a regenerated answer) says so rather than showing another. One not
 * found while the answer is still due (Lawexa is writing, or the transcript
 * ends on the question) is waited for instead: the case page's chat moving to
 * its docked frame mid-turn showed "no longer in the chat" until the answer
 * arrived (Lucy's recording, 25 October 2026).
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
 *
 * A draft Lawexa has written more than once (draft-versions.ts) gets a strip
 * under the bar to step between its versions, and saves and downloads under
 * "Title (Version 2)", so each version is its own note and its own file.
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
  const chat = useV2ChatContext();
  const conversationId = chat?.conversationId;
  const panel = useSidePanel();
  const space = panel?.space ?? null;

  let draft: DraftBlock | null = null;
  if ('messageId' in place) {
    const message = messages.find((candidate) => candidate.id === place.messageId);
    draft = message ? (draftsIn(message.content)[place.index] ?? null) : null;
  } else if (streamingMessage) {
    draft = draftsIn(live, true)[place.streamingIndex] ?? null;
  }

  const answerDue = Boolean(chat?.isStreaming) || messages[messages.length - 1]?.role === 'user';
  if (!draft && answerDue) {
    return (
      <ChatSidePanel label="Draft" title="Draft" icon={<DraftIcon />} bare>
        <DraftBar />
        <div role="status" className="space-y-3 px-5 py-8 xl:px-12">
          <span className="sr-only">Lawexa is still writing this draft.</span>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </ChatSidePanel>
    );
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

  const version = panel?.draftVersion(ordinal, draftGroupKey(draft)) ?? null;
  const versionSwitch = <DraftVersionSwitch version={version} />;

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
          title={draftVersionTitle(draft.title, version)}
          markdown={draft.body}
          font={{ font: draft.font, size: draft.size }}
          space={space}
          versionSwitch={versionSwitch}
        />
      ) : (
        <div className="@container/draft">
          <DraftBar />
          {versionSwitch}
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
