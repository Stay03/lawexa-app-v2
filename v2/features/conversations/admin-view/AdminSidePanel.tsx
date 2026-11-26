'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { EngineMessage, StreamingSource } from '@/v2/runtime/chat-engine';
import { DraftNotesSourceProvider } from '../conversation/draft/draft-notes-source';
import { DraftPanel } from '../conversation/draft/DraftPanel';
import { draftOffsets } from '../conversation/draft/draft-ordinals';
import {
  draftGroupTitle,
  draftKeysByMessage,
  draftKeysFor,
  draftVersion,
  draftVersionIndex,
  type KeyedDraft,
} from '../conversation/draft/draft-versions';
import { FilePanel } from '../conversation/files/FilePanel';
import { AgentConversationPanel } from '../conversation/agents/AgentConversationPanel';
import { AgentPanelSourceProvider } from '../conversation/agents/agent-panel-source';
import {
  SidePanelValueProvider,
  useSidePanel,
  useSidePanelUrl,
  type SidePanelKind,
} from '../conversation/side-panel/SidePanelContext';
import { ADMIN_AGENT_PANEL } from './admin-agent-panel';
import { adminDraftNotesSource } from './admin-draft-notes';

/**
 * What staff may open beside the owner's chat. Never the machine: it is the
 * owner's live computer, with controls, not a record of the chat.
 */
const ADMIN_KINDS: ReadonlySet<SidePanelKind> = new Set<SidePanelKind>(['draft', 'file', 'agent']);

/**
 * The admin view's side panel (Stay, thread 085a980c, 26 November 2026: "Is
 * it like for like as user side?" and "1 and make sure other stuff are like
 * for like"). The owner's chat opens a draft, a file and the rest beside the
 * transcript; the admin view did not have one, so a draft was printed whole in
 * the transcript. Now the same cards open the same panels, read only:
 *
 *   draft  the owner's draft panel on the owner's note (admin draft-notes
 *          routes, draft-notes-source.tsx): versions, Show changes, history
 *          and downloads; no editing, no save, no restore.
 *   file   the owner's file panel (an admin may open a file outside a Space;
 *          a Space file says so).
 *   agent  the owner's agent panel on the admin routes, a snapshot: no
 *          message box, no Stop, no live turn (admin-agent-panel.ts).
 *
 * Never the machine (the owner's live computer): its buttons ask the panel
 * (`shows`) and do not draw here.
 *
 * The page owns `?side=` (a link to a draft opens it) and lays itself out
 * round the panel: it gives the panel a box beside its column on a computer
 * (`host`), told by `onOpenChange`; below xl the panel is the owner's sheet.
 */
export function AdminSidePanel({
  conversationId,
  messages,
  streamingText,
  host,
  onOpenChange,
  children,
}: {
  conversationId: string;
  messages: readonly EngineMessage[];
  streamingText: StreamingSource;
  /** The page's box for the panel; `null` until it is drawn. */
  host: HTMLElement | null;
  /** The panel opened or closed, so the page can make room for it. */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const url = useSidePanelUrl();
  // The chat's drafts by place and by group, as the owner's chat page counts them (ConversationScreen).
  const offsets = useMemo(() => draftOffsets(messages), [messages]);
  const lookups = useMemo(() => {
    const index = draftVersionIndex(messages);
    const savedKeys = draftKeysByMessage(messages);
    return {
      keys: (messageId: string | null, drafts: readonly KeyedDraft[]) => {
        const saved = messageId ? savedKeys.get(messageId) : undefined;
        return saved && saved.length === drafts.length ? saved : draftKeysFor(messages, messageId, drafts);
      },
      versions: (ordinal: number, key: string) => draftVersion(index, ordinal, key),
      titles: (key: string) => draftGroupTitle(index, key),
    };
  }, [messages]);
  const source = useMemo(() => adminDraftNotesSource(conversationId), [conversationId]);

  const open = url.target !== null;
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // The box stands as tall as the page's scroller, so the panel stays in view while the chat scrolls past it.
  useEffect(() => {
    if (!host) return;
    const scroller = scrollParent(host);
    if (!scroller) return;
    const observer = new ResizeObserver(() => host.style.setProperty('--admin-side-panel-h', `${scroller.clientHeight}px`));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [host]);

  return (
    <DraftNotesSourceProvider value={source}>
      <AgentPanelSourceProvider value={ADMIN_AGENT_PANEL}>
        <SidePanelValueProvider
          url={url}
          offsets={offsets}
          versions={lookups.versions}
          titles={lookups.titles}
          keys={lookups.keys}
          space={null}
          frame="card"
          kinds={ADMIN_KINDS}
        >
          {children}
          {host ? createPortal(<AdminSidePanelSlot messages={messages} streamingText={streamingText} />, host) : null}
        </SidePanelValueProvider>
      </AgentPanelSourceProvider>
    </DraftNotesSourceProvider>
  );
}

/** What the admin view's panel holds for the open `?side=`: the kinds it shows read only. */
function AdminSidePanelSlot({ messages, streamingText }: { messages: readonly EngineMessage[]; streamingText: StreamingSource }) {
  const target = useSidePanel()?.target;
  if (!target) return null;
  switch (target.kind) {
    case 'draft':
      return <DraftPanel key={target.ordinal} ordinal={target.ordinal} messages={messages} streamingText={streamingText} />;
    case 'file':
      return <FilePanel key={target.id} fileId={target.id} />;
    case 'agent':
      return <AgentConversationPanel key={target.id} conversationId={target.id} />;
    default:
      return null;
  }
}

/** The nearest box that scrolls: the admin shell's content region. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return el;
  }
  return null;
}
