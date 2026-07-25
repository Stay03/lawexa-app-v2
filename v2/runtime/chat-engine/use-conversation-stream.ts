'use client';

/**
 * v2 chat-engine — React adapter.
 *
 * Reflects the framework-light {@link createChatEngine} core into a component. The
 * engine owns every timer, stream, and buffer (so there is NO setState-in-effect —
 * the only sanctioned bridge, `useSyncExternalStore`, carries structural updates);
 * this hook is a thin, React-Compiler-clean shell around it.
 *
 * Consumer contract for waves 2–3:
 *  - `useConversationStream(options)` returns v1's `useChatStream` surface (messages,
 *    isStreaming, isCancelling, isLoadingHistory, conversationId, conversationTitle,
 *    error + every action) PLUS the two per-message streaming sources.
 *  - A streaming assistant row renders its live tokens with
 *    `useStreamingText(result.streamingText, message.id)` — it re-renders on the
 *    ~60ms flush cadence, and NO other row (nor the list container) re-renders while
 *    tokens arrive. This is the fix for v1's biggest chat defect (every token
 *    re-rendered the whole list).
 *  - An active HandoverMessage row streams the specialist's text the same way:
 *    `useStreamingText(result.streamingText, handover.id)`.
 *  - The reasoning trace (§C thinking upgrade) streams via
 *    `useStreamingReasoning(result.reasoning, message.id)` while the message is
 *    streaming; once finalized, `message.reasoning` / `message.reasoningMs` carry
 *    the "Thought for Ns" trace on the structural message.
 */

import { useState, useEffect, useCallback, useSyncExternalStore, startTransition } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { createChatEngine } from './engine';
import type { ChatEngine, ChatEngineConfig, ChatEngineSnapshot, StreamingSource } from './types';

/**
 * Options the host passes in. It is {@link ChatEngineConfig} minus the two pieces
 * the adapter supplies itself: `getToken` (wired to the authStore bridge) and
 * `commit` (React's `startTransition`).
 */
export type UseConversationStreamOptions = Omit<ChatEngineConfig, 'getToken' | 'commit'>;

/**
 * Subscribe a single row to its live streaming-answer text. Isolated by message id
 * via `useSyncExternalStore`, so only this row re-renders on each flush.
 */
export function useStreamingText(source: StreamingSource, messageId: string): string {
  const subscribe = useCallback(
    (onChange: () => void) => source.subscribe(messageId, onChange),
    [source, messageId],
  );
  const getSnapshot = useCallback(() => source.get(messageId), [source, messageId]);
  return useSyncExternalStore(subscribe, getSnapshot, EMPTY);
}

/**
 * Subscribe a single row to its live reasoning trace (§C). Same isolation model as
 * {@link useStreamingText}.
 */
export function useStreamingReasoning(source: StreamingSource, messageId: string): string {
  const subscribe = useCallback(
    (onChange: () => void) => source.subscribe(messageId, onChange),
    [source, messageId],
  );
  const getSnapshot = useCallback(() => source.get(messageId), [source, messageId]);
  return useSyncExternalStore(subscribe, getSnapshot, EMPTY);
}

/** Stable server/initial snapshot for the per-message stores (never streaming on SSR). */
const EMPTY = () => '';

export interface UseConversationStreamResult {
  // ── Structural state (v1 useChatStream parity) ──
  messages: ChatEngineSnapshot['messages'];
  isStreaming: boolean;
  isCancelling: boolean;
  isLoadingHistory: boolean;
  conversationId: string | null;
  conversationTitle: string | null;
  error: string | null;
  // ── Per-message live streaming sources (for wave-3 rows) ──
  streamingText: StreamingSource;
  reasoning: StreamingSource;
  // ── Actions (v1 useChatStream parity) ──
  send: ChatEngine['send'];
  connectToStream: ChatEngine['connectToStream'];
  adoptConversationHistory: ChatEngine['adoptConversationHistory'];
  loadConversationHistoryFromIDB: ChatEngine['loadConversationHistoryFromIDB'];
  fetchConversationTitle: ChatEngine['fetchConversationTitle'];
  setConversationId: ChatEngine['setConversationId'];
  addUserMessage: ChatEngine['addUserMessage'];
  disconnect: ChatEngine['disconnect'];
  cancelStream: ChatEngine['cancelStream'];
  clearChat: ChatEngine['clearChat'];
  setError: ChatEngine['setError'];
  retryLastMessage: ChatEngine['retryLastMessage'];
  recoverPendingState: ChatEngine['recoverPendingState'];
}

export function useConversationStream(
  options: UseConversationStreamOptions = {},
): UseConversationStreamResult {
  // ONE engine per hook instance, created lazily (never in an effect — a useState
  // initializer runs once and keeps the engine stable across re-renders). The
  // construction-only wiring (`getToken` → authStore bridge, `commit` → React
  // transition) never changes; the first render's callbacks seed the handlers and
  // the effect below keeps them fresh — so no ref is smuggled through render (which
  // the React Compiler `react-hooks/refs` rule forbids).
  //
  // `options.initialHistory` rides this SAME once-only channel by design: the host
  // passes the warm cache entry for the conversation it is opening, and the engine
  // is born holding that transcript, so the first committed render already paints it
  // (no skeleton, no empty frame). Later renders' `initialHistory` is ignored —
  // history that arrives after construction goes through the guarded
  // `adoptConversationHistory`, which is what keeps a background revalidation from
  // ever racing a live stream.
  const [engine] = useState<ChatEngine>(() =>
    createChatEngine({
      ...options,
      getToken: () => useAuthStore.getState().token,
      commit: (fn) => startTransition(fn),
    }),
  );

  // Push the latest callbacks + mode resolvers into the long-lived engine every
  // render. Engine callbacks fire from async SSE events (always after this effect),
  // so they never see a stale handler. Not a setState — no React-Compiler conflict.
  //
  // `smoothing` rides the same effect. It used to be construction-only, which meant
  // the streaming-style preference could not reach an already-built engine (this
  // hook's `useState` initializer runs exactly once, and `updateHandlers` only swaps
  // `ChatEngineHandlers`) — changing it silently did nothing until a remount. The
  // engine's `setSmoothing` re-resolves both smoothers' configs in place and no-ops
  // when nothing changed, so calling it every render is free.
  useEffect(() => {
    engine.updateHandlers(options);
    engine.setSmoothing(options.smoothing);
  });

  // Tear down the live stream + timers on unmount (idempotent; the engine stays
  // reusable across a StrictMode remount — React re-subscribes automatically).
  useEffect(() => () => engine.disconnect(), [engine]);

  // Reflect the engine's structural store. External-store updates are the ONLY
  // way state reaches React here — no effect writes component state.
  const snapshot = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getServerSnapshot,
  );

  return {
    messages: snapshot.messages,
    isStreaming: snapshot.isStreaming,
    isCancelling: snapshot.isCancelling,
    isLoadingHistory: snapshot.isLoadingHistory,
    conversationId: snapshot.conversationId,
    conversationTitle: snapshot.conversationTitle,
    error: snapshot.error,
    streamingText: engine.streamingText,
    reasoning: engine.reasoning,
    send: engine.send,
    connectToStream: engine.connectToStream,
    adoptConversationHistory: engine.adoptConversationHistory,
    loadConversationHistoryFromIDB: engine.loadConversationHistoryFromIDB,
    fetchConversationTitle: engine.fetchConversationTitle,
    setConversationId: engine.setConversationId,
    addUserMessage: engine.addUserMessage,
    disconnect: engine.disconnect,
    cancelStream: engine.cancelStream,
    clearChat: engine.clearChat,
    setError: engine.setError,
    retryLastMessage: engine.retryLastMessage,
    recoverPendingState: engine.recoverPendingState,
  };
}
