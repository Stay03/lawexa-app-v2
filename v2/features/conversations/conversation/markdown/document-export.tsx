'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { blockIndexOf, lazyFencedBlockTexts, type DocumentExportTarget } from './export-target';

/**
 * Where a document block may offer "Download as Word". The export route reads
 * the block from the SAVED message (`POST /api/conversations/{id}/messages/
 * {messageId}/export-docx` with `{ block }`), so the block needs both ids and
 * the saved text to number itself. Two providers carry them:
 *
 * - {@link DocumentExportScope}, on the conversation screen, set only when the
 *   viewer owns the chat and it is not confidential (the route answers 404 for
 *   both). The channel glance panel and shared views mount none.
 * - {@link MessageDocumentScope}, on an assistant row, set only once the answer
 *   is saved and has landed: it has a server id and is not streaming or
 *   draining. A history row carries the id in its row id (`msg_{id}`); an
 *   answer the engine drew from the stream gets it when the turn completes
 *   (`savedId`, chat-engine/answer-id.ts).
 *
 * With either missing, {@link useDocumentExport} returns null and the block
 * shows Copy and Maximize only.
 */
interface ExportScope {
  conversationId: string;
}

interface MessageScope extends ExportScope {
  messageId: number;
  /** The saved answer's fenced blocks, parsed on the first ask. */
  blocks: () => readonly string[];
}

const ExportScopeContext = createContext<ExportScope | null>(null);
const MessageScopeContext = createContext<MessageScope | null>(null);

export function DocumentExportScope({
  conversationId,
  enabled,
  children,
}: {
  conversationId: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => (enabled ? { conversationId } : null), [conversationId, enabled]);
  return <ExportScopeContext.Provider value={value}>{children}</ExportScopeContext.Provider>;
}

export function MessageDocumentScope({
  messageId,
  content,
  landed,
  children,
}: {
  /** The server's id for this answer, or null while it has none. */
  messageId: number | null;
  /** The saved answer text, as the server holds it. */
  content: string;
  /** Not streaming and not draining: the text on screen is the whole answer. */
  landed: boolean;
  children: ReactNode;
}) {
  const scope = useContext(ExportScopeContext);
  // Parsed only for a row that can offer Download, only when a document block
  // asks (useDocumentExport), and again only when the text changes.
  const value = useMemo<MessageScope | null>(
    () =>
      scope && landed && messageId !== null && (content.includes('```') || content.includes('~~~'))
        ? { conversationId: scope.conversationId, messageId, blocks: lazyFencedBlockTexts(content) }
        : null,
    [scope, landed, messageId, content],
  );
  return (
    <MessageScopeContext.Provider value={value}>
      <SavedMessageContext.Provider value={landed ? messageId : null}>{children}</SavedMessageContext.Provider>
    </MessageScopeContext.Provider>
  );
}

/**
 * The saved answer this content belongs to, once it has landed: its server
 * id, or `null` while it streams or has none yet. A quiz card in the answer
 * reports a question by it (Arthur's question feedback, 26 October 2026).
 */
const SavedMessageContext = createContext<number | null>(null);

export function useSavedMessageId(): number | null {
  return useContext(SavedMessageContext);
}

/** The export target for a block with this text, or null when it offers no Download. */
export function useDocumentExport(text: string): DocumentExportTarget | null {
  const scope = useContext(MessageScopeContext);
  if (!scope) return null;
  const block = blockIndexOf(scope.blocks(), text);
  if (block === null) return null;
  return { conversationId: scope.conversationId, messageId: scope.messageId, block };
}
