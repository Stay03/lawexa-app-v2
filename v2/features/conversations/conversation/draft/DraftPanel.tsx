'use client';

import { useState } from 'react';
import { Check, Copy, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine/types';
import { useStreamingText } from '@/v2/runtime/chat-engine/use-conversation-stream';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { MarkdownText } from '../markdown/MarkdownText';
import { ChatSidePanel } from '../side-panel/ChatSidePanel';
import { draftStatus, draftsIn, type DraftBlock } from './draft-blocks';
import { locateDraft } from './draft-ordinals';

/**
 * DraftPanel — draft N of this chat in the side panel (`?side=draft:N`).
 *
 * It finds the draft by its place (draft-ordinals.ts): in a saved answer's
 * text, or, past them, in the answer still streaming, read live so the panel
 * shows the draft as it is written. A draft that is no longer in the chat (an
 * old link, a regenerated answer) says so rather than showing another.
 *
 * Reading only, in this piece: the editor with font type and size, and saving,
 * come next.
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

  let draft: DraftBlock | null = null;
  if ('messageId' in place) {
    const message = messages.find((candidate) => candidate.id === place.messageId);
    draft = message ? (draftsIn(message.content)[place.index] ?? null) : null;
  } else if (streamingMessage) {
    draft = draftsIn(live, true)[place.streamingIndex] ?? null;
  }

  if (!draft) {
    return (
      <ChatSidePanel label="Draft" title="Draft" icon={<DraftIcon />}>
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
      subtitle={draftStatus(draft, Boolean(streamingMessage))}
      icon={<DraftIcon />}
      footer={<CopyDraft text={draft.body} disabled={!draft.complete} />}
    >
      <article className="mx-auto w-full max-w-[68ch] px-5 py-6 xl:px-8 xl:py-8">
        <MarkdownText content={draft.body} animate={!draft.complete && Boolean(streamingMessage)} />
      </article>
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

/** Copy the draft's text; the panel's one action until saving arrives. */
function CopyDraft({ text, disabled }: { text: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className={cn(
        'v2-interactive flex h-10 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50',
        FOCUS_RING,
      )}
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {copied ? 'Copied' : 'Copy text'}
    </button>
  );
}
