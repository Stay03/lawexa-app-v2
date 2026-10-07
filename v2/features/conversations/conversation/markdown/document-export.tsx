'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { blockIndexOf, fencedBlockTexts, savedMessageId, type DocumentExportTarget } from './export-target';

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
 *   is saved and has landed: a server row id (`msg_{id}`), not streaming, not
 *   draining. A row the engine drew itself (`local_…`) keeps no server id, so
 *   its blocks offer Download once the chat is next loaded from the server.
 *
 * With either missing, {@link useDocumentExport} returns null and the block
 * shows Copy and Maximize only.
 */
interface ExportScope {
  conversationId: string;
}

interface MessageScope extends ExportScope {
  messageId: number;
  blocks: readonly string[];
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
  rowId,
  content,
  landed,
  children,
}: {
  rowId: string;
  /** The saved answer text, as the server holds it. */
  content: string;
  /** Not streaming and not draining: the text on screen is the whole answer. */
  landed: boolean;
  children: ReactNode;
}) {
  const scope = useContext(ExportScopeContext);
  const messageId = savedMessageId(rowId);
  // Parsed only for a row that can offer Download, and only when its text changes.
  const value = useMemo<MessageScope | null>(
    () =>
      scope && landed && messageId !== null && (content.includes('```') || content.includes('~~~'))
        ? { conversationId: scope.conversationId, messageId, blocks: fencedBlockTexts(content) }
        : null,
    [scope, landed, messageId, content],
  );
  return <MessageScopeContext.Provider value={value}>{children}</MessageScopeContext.Provider>;
}

/** The export target for a block with this text, or null when it offers no Download. */
export function useDocumentExport(text: string): DocumentExportTarget | null {
  const scope = useContext(MessageScopeContext);
  if (!scope) return null;
  const block = blockIndexOf(scope.blocks, text);
  if (block === null) return null;
  return { conversationId: scope.conversationId, messageId: scope.messageId, block };
}
