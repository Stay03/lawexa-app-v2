'use client';

import { createContext, useContext, useMemo } from 'react';

import type { DraftEditLineFields } from '@/v2/features/notes/types';

/**
 * V2 conversation chat context — the v2-native replacement for v1's
 * `lib/contexts/chat-context` (boundary-blocked). Inline result cards (quiz,
 * multi-question, deep-research, next-question) fire follow-up turns through
 * `sendMessage`; the same cards read `isStreaming` to disable their actions
 * while a turn is in flight, and `canSend` to disable them for a reader who
 * may not send (Spaces F4: a space's Viewer, a shared link). The value shape
 * is v1's plus `canSend`, so the ported cards stay a near-verbatim port.
 *
 * `useV2ChatContext()` returns `null` when no provider is mounted (mirrors v1),
 * so a card rendered outside a conversation degrades gracefully rather than
 * throwing.
 */
interface V2ChatContextValue {
  sendMessage: (message: string) => void;
  isStreaming: boolean;
  /** Whether the reader may send in this chat (the controller's `canSend`). */
  canSend: boolean;
  /** The open chat's id: a step's result is fetched under it (tools/use-tool-result.ts). */
  conversationId: string;
  /**
   * A draft save or restore answered: draw, move or take away the chat's
   * "edited" line at once (draft/draft-edit-line.ts; Stay, 30 October 2026,
   * 02:16Z, thread 1e44eb39). Stable: it only reaches the chat's engine.
   */
  applyDraftEditLine: (answer: DraftEditLineFields) => void;
}

const V2ChatContext = createContext<V2ChatContextValue | null>(null);

export function V2ChatProvider({
  children,
  sendMessage,
  isStreaming,
  canSend,
  conversationId,
  applyDraftEditLine,
}: {
  children: React.ReactNode;
  sendMessage: (message: string) => void;
  isStreaming: boolean;
  canSend: boolean;
  conversationId: string;
  applyDraftEditLine: (answer: DraftEditLineFields) => void;
}) {
  // Stable value — only changes when the streaming flag (or `canSend`) flips, never per token
  // (tokens flow through the per-message streaming store, not this context), so
  // the card subtree never re-renders on stream growth.
  const value = useMemo<V2ChatContextValue>(
    () => ({ sendMessage, isStreaming, canSend, conversationId, applyDraftEditLine }),
    [sendMessage, isStreaming, canSend, conversationId, applyDraftEditLine],
  );
  return <V2ChatContext.Provider value={value}>{children}</V2ChatContext.Provider>;
}

export function useV2ChatContext(): V2ChatContextValue | null {
  return useContext(V2ChatContext);
}
