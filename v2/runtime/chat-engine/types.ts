/**
 * v2 chat-engine — public types.
 *
 * This is the typed contract shared by the framework-light core ({@link engine.ts})
 * and its React adapter ({@link use-conversation-stream.ts}). It is the surface
 * waves 2 (composer wiring) and 3 (conversation screen + virtualized list) build
 * against — so every consumer-facing shape lives here, documented.
 *
 * The engine is a faithful port of v1's `lib/hooks/useChatStream.ts` (the audit's
 * SSE-resilience "crown jewel") lifted out of the 1470-line god component into a
 * clean layered core. Wire protocol is preserved EXACTLY: same endpoints, same SSE
 * event names, same seq/dedup semantics (the backend does not change). The event
 * and message shapes are re-used from `@/types/chat` unchanged; this module only
 * adds the v2-layer types (config, snapshots, the streaming-render subscription
 * contract, and the NEW per-message reasoning trace).
 */

import type {
  ConversationMessage,
  MessageAttachment,
  SendMessageOptions,
  IterationEvent,
  ToolCallingEvent,
  ToolCompleteEvent,
  CompletedEvent,
  ConversationData,
} from '@/types/chat';

// ─── Reasoning trace (§C thinking upgrade) ─────────────────────────────────
// v1 RECEIVES `thinking` SSE events and DISCARDS their payload (useChatStream
// ~918-921 only resets the stale-detection counters). The v2 engine accumulates
// the model's reasoning tokens per assistant message so the conversation screen
// can render a collapsible "reasoning" trace that auto-collapses to "Thought for
// Ns" on finish (foundation-standards §5). These optional fields ride on every
// message (only assistant text messages ever carry them).
export interface ReasoningTrace {
  /** Accumulated reasoning/thinking text, finalized when the message completes. */
  reasoning?: string;
  /** Wall-clock ms the model spent reasoning — powers the "Thought for Ns" label. */
  reasoningMs?: number;
}

/**
 * The engine's render model for a single row. It is v1's {@link ConversationMessage}
 * union widened with the optional {@link ReasoningTrace}. Because the trace fields
 * are optional, plain `ConversationMessage[]` values (e.g. from
 * `transformApiMessages`) remain assignable to `EngineMessage[]`.
 */
export type EngineMessage = ConversationMessage & ReasoningTrace;

// ─── Structural snapshot (the useSyncExternalStore surface) ─────────────────
/**
 * Immutable snapshot of the engine's STRUCTURAL state — the message list plus the
 * status flags the UI banners consume. A new object is produced ONLY on a
 * structural change (a message is added / removed / finalized, a status flag
 * flips, history loads, an error surfaces). It is deliberately NOT produced on
 * per-token text deltas: those flow through the per-message streaming-text store
 * ({@link StreamingSource}) so a single streaming row re-renders without the list
 * (foundation-standards §5). `getSnapshot()` returns the same reference until the
 * next structural change, satisfying `useSyncExternalStore`'s identity contract.
 */
export interface ChatEngineSnapshot {
  messages: readonly EngineMessage[];
  isStreaming: boolean;
  /**
   * Optimistic flag between clicking Stop (cancel POST fired) and the
   * authoritative terminal SSE event (`cancelled`/`completed`/`error`/`timeout`).
   */
  isCancelling: boolean;
  isLoadingHistory: boolean;
  conversationId: string | null;
  conversationTitle: string | null;
  error: string | null;
}

// ─── Per-message live text/reasoning subscription (streaming-render policy) ──
/**
 * A per-message live-value subscription surface, isolated by message id. This is
 * the mechanism that keeps token arrival from storming the transcript: a row
 * subscribes to its OWN id and re-renders on the ~60ms flush cadence, while every
 * other row and the list container stay untouched.
 *
 * Two instances are exposed by the engine — one for streaming answer text
 * ({@link ChatEngine.streamingText}) and one for the live reasoning trace
 * ({@link ChatEngine.reasoning}). Both are consumed via `useSyncExternalStore`
 * (see `useStreamingText` / `useStreamingReasoning` in the adapter).
 *
 * NOTE (React RFC 0214 / react.dev): external-store updates are always applied
 * synchronously and CANNOT be deferred by `startTransition`. The non-blocking
 * guarantee therefore comes from the coalescing flush cadence + per-row isolation,
 * not from a transition wrapper. See the flush policy in {@link engine.ts}.
 */
export interface StreamingSource {
  /** Subscribe to changes of a single message's live value. Returns unsubscribe. */
  subscribe(messageId: string, listener: () => void): () => void;
  /** Current live value for a message id ('' when none). Stable between flushes. */
  get(messageId: string): string;
}

// ─── Recovery result (page reload / direct navigation) ─────────────────────
/**
 * Outcome of {@link ChatEngine.recoverPendingState}. `reconnected` means the
 * engine re-attached to a live execution (SSE or poll); every other value tells
 * the caller to load history normally (mirrors v1's return union exactly).
 */
export type RecoverResult =
  | 'reconnected'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'idle'
  | 'load_history';

// ─── Engine handlers (hot-swappable callbacks + mode resolvers) ─────────────
/**
 * The parts of the config that change with every host render — lifecycle
 * callbacks and the confidential/redacted resolvers. Kept separate from the
 * construction-only config so the React adapter can push the latest set into a
 * long-lived engine via {@link ChatEngine.updateHandlers} (rather than rebuilding
 * the engine or smuggling a ref through render).
 */
export interface ChatEngineHandlers {
  /**
   * Resolves whether a conversation is confidential. Confidential conversations
   * 404 from the server by design and are transcript-backed in IndexedDB. The
   * engine reads this at event time (text_done / completed) and on the IDB history
   * path. Wave-2 wires this to the ported confidential-mode store; defaults to
   * `false` (non-confidential) so the engine is usable before that store exists.
   */
  isConfidential?: (conversationId: string | null | undefined) => boolean;

  /**
   * Resolves whether a conversation is redacted. When true, the engine swaps the
   * optimistic user turn for the server's canonical redacted form on send, and
   * fails closed on a 503 from the redaction service. Wave-2 wires this to the
   * ported redacted-mode store; defaults to `false`.
   */
  isRedacted?: (conversationId: string | null | undefined) => boolean;

  // ── Lifecycle callbacks (v1 UseChatStreamOptions parity) ──
  onConnected?: () => void;
  onIteration?: (event: IterationEvent) => void;
  onToolCalling?: (event: ToolCallingEvent) => void;
  onToolComplete?: (event: ToolCompleteEvent) => void;
  onCompleted?: (event: CompletedEvent) => void;
  onError?: (error: string) => void;
  onHistoryLoaded?: (data: ConversationData) => void;
  /**
   * Fired with inter-phase narration text (and an optional sub-agent slug). The v1
   * "Option A" narration-vs-final heuristic decides what is transient narration
   * vs. the orchestrator's real answer; only narration reaches this callback.
   */
  onNarration?: (text: string, agentSlug?: string) => void;
}

// ─── Engine configuration ───────────────────────────────────────────────────
/**
 * Construction config for {@link createChatEngine}. Everything the framework-light
 * core needs from its host is injected here, so the core imports no React and no
 * global stores — it can be driven and unit-tested in isolation. Extends
 * {@link ChatEngineHandlers} with the construction-only pieces.
 */
export interface ChatEngineConfig extends ChatEngineHandlers {
  /**
   * Reads the current bearer token at action time (connect / cancel). A getter,
   * not a value, so the engine always uses the freshest token without the adapter
   * having to re-subscribe. The adapter wires this to the authStore token bridge.
   */
  getToken: () => string | null;

  /**
   * Token-flush cadence in ms (foundation-standards §5 prescribes 50–80ms).
   * Defaults to 60. Lower = smoother, higher = fewer re-renders.
   */
  flushIntervalMs?: number;

  /**
   * Wraps every flush/structural commit. The adapter passes React's
   * `startTransition`; the default is a synchronous passthrough (keeping the core
   * framework-free). Present to honor foundation-standards §5's "wrapped in
   * startTransition" directive and to stay forward-compatible — though per the
   * note on {@link StreamingSource}, transitions are currently inert for the
   * external-store notifications the flush performs.
   */
  commit?: (fn: () => void) => void;
}

// ─── The engine handle ──────────────────────────────────────────────────────
/**
 * The framework-light core returned by {@link createChatEngine}. The React adapter
 * ({@link useConversationStream}) reflects it into a component; wave-3 rows read
 * live text/reasoning through {@link streamingText}/{@link reasoning}. Every action
 * mirrors a v1 `useChatStream` method 1:1 for a drop-in parity surface.
 */
export interface ChatEngine {
  // ── Structural store (useSyncExternalStore) ──
  /** Subscribe to structural changes; returns unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Current structural snapshot (stable ref until the next structural change). */
  getSnapshot(): ChatEngineSnapshot;
  /** SSR/initial snapshot — a frozen, stable empty state. */
  getServerSnapshot(): ChatEngineSnapshot;

  // ── Per-message live streaming surfaces (streaming-render policy) ──
  /** Live answer text for streaming assistant / sub-agent rows, by message id. */
  readonly streamingText: StreamingSource;
  /** Live reasoning trace for streaming rows, by message id (§C thinking upgrade). */
  readonly reasoning: StreamingSource;

  // ── Actions (v1 useChatStream parity) ──
  send(message: string, options?: SendMessageOptions): Promise<void>;
  connectToStream(
    executionId: string,
    initialMessage?: string,
    initialAttachments?: MessageAttachment[] | MessageAttachment,
  ): void;
  loadConversationHistory(conversationId: string): Promise<void>;
  loadConversationHistoryFromIDB(conversationId: string): Promise<boolean>;
  fetchConversationTitle(convId: string): Promise<void>;
  setConversationId(id: string): void;
  addUserMessage(
    content: string,
    attachments?: MessageAttachment[] | MessageAttachment,
  ): EngineMessage;
  disconnect(): void;
  cancelStream(): void;
  clearChat(): void;
  setError(error: string | null): void;
  retryLastMessage(): Promise<void>;
  recoverPendingState(conversationId: string): Promise<RecoverResult>;

  /**
   * Replace the live callbacks + mode resolvers on a long-lived engine. The React
   * adapter calls this from an effect each render so a single engine instance
   * always invokes the freshest handlers without being rebuilt.
   */
  updateHandlers(handlers: ChatEngineHandlers): void;

  /** Full teardown for React unmount — disconnects and stops every timer. */
  dispose(): void;
}
