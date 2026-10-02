'use client';

import { createContext, useContext, useMemo } from 'react';

/**
 * V2 conversation chat context — the v2-native replacement for v1's
 * `lib/contexts/chat-context` (boundary-blocked). Inline result cards (quiz,
 * multi-question, deep-research, next-question) fire follow-up turns through
 * `sendMessage`; the same cards read `isStreaming` to disable their actions
 * while a turn is in flight. The value shape matches v1's exactly so the ported
 * cards stay a near-verbatim port.
 *
 * `useV2ChatContext()` returns `null` when no provider is mounted (mirrors v1),
 * so a card rendered outside a conversation degrades gracefully rather than
 * throwing.
 */
interface V2ChatContextValue {
  sendMessage: (message: string) => void;
  isStreaming: boolean;
  /** The open chat's id: a step's result is fetched under it (tools/use-tool-result.ts). */
  conversationId: string;
}

const V2ChatContext = createContext<V2ChatContextValue | null>(null);

export function V2ChatProvider({
  children,
  sendMessage,
  isStreaming,
  conversationId,
}: {
  children: React.ReactNode;
  sendMessage: (message: string) => void;
  isStreaming: boolean;
  conversationId: string;
}) {
  // Stable value — only changes when the streaming flag flips, never per token
  // (tokens flow through the per-message streaming store, not this context), so
  // the card subtree never re-renders on stream growth.
  const value = useMemo<V2ChatContextValue>(
    () => ({ sendMessage, isStreaming, conversationId }),
    [sendMessage, isStreaming, conversationId],
  );
  return <V2ChatContext.Provider value={value}>{children}</V2ChatContext.Provider>;
}

export function useV2ChatContext(): V2ChatContextValue | null {
  return useContext(V2ChatContext);
}
