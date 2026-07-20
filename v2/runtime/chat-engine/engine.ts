'use client';

/**
 * v2 chat-engine — framework-light core.
 *
 * A faithful port of v1's `lib/hooks/useChatStream.ts` (the audit's SSE-resilience
 * "crown jewel"), lifted out of the god component into a plain state machine with
 * NO React imports. It owns the EventSource connection, the full resilience surface
 * (watchdog, heartbeat stale-detection, reconnect→poll, seq dedup, accumulated_text
 * replay, recovery, graceful cancel), the confidential IndexedDB integration, and
 * the v2 streaming-render policy v1 lacked (foundation-standards §5): tokens buffer
 * outside React and flush on a 50–80ms cadence into per-message subscription stores,
 * so token arrival never re-renders the transcript.
 *
 * The wire protocol is byte-for-byte v1: same endpoints, same SSE event names, same
 * seq/dedup semantics. Every ported behavior is annotated with the reason it exists,
 * so the next wave never has to re-derive (e.g.) why the watchdog is 60s.
 *
 * The React adapter that reflects this into a component is
 * `use-conversation-stream.ts`; the typed contract is `types.ts`.
 */

import { AxiosError } from 'axios';
import { chatApi } from '@/lib/api/chat';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import { applyJurisdiction } from '@/lib/utils/jurisdiction-payload';
import { extractBlockedReason } from '@/lib/utils/api-error';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import {
  isErrorMessage,
  type ChatMessage,
  type ToolMessage,
  type HandoverMessage,
  type ErrorMessage,
  type ConversationMessage,
  type MessageAttachment,
  type ApiMessage,
  type SendMessageOptions,
  type CompletedEvent,
  type ToolCallingEvent,
  type ToolCompleteEvent,
  type IterationEvent,
  type HandoverStartedEvent,
  type HandoverCompleteEvent,
  type TextDeltaEvent,
  type TextDoneEvent,
  type TextResetEvent,
  type ConnectedEvent,
  type PendingResponseData,
} from '@/types/chat';
import {
  appendAssistantTurn,
  appendUserTurn,
  getTranscript,
  historyEntriesFor,
  isConfidentialAttachmentExpired,
  replaceLastUserTurnContent,
} from './confidential-transcript';
import { createStreamSmoother } from './stream-smoother';
import type {
  ChatEngine,
  ChatEngineConfig,
  ChatEngineHandlers,
  ChatEngineSnapshot,
  EngineMessage,
  ReasoningTrace,
  RecoverResult,
  StreamingSource,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Unique per-message id for engine-originated (SSE) messages. Uses Date.now +
// random — called only from actions/handlers, never during React render.
const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// ─── Resilience constants (ported verbatim from v1, with their rationale) ───

// SSE watchdog: if no events arrive for this long, the stream is presumed dead
// and we reconnect/poll. Checked on a coarser interval to keep the timer cheap.
const WATCHDOG_SILENCE_MS = 60_000;
const WATCHDOG_CHECK_MS = 10_000;

// Polling fallback: after reconnects are exhausted, poll status every 5s, giving
// up after 10 minutes (a hard cap so a stuck execution can't poll forever).
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_DURATION_MS = 600_000; // 10 minutes

// SSE reconnection: retry the live stream up to 3× (1s apart) before falling back
// to polling. The backend resumes from Redis if still running, or returns the DB
// result if already finished.
const SSE_MAX_RECONNECTS = 3;
const SSE_RECONNECT_DELAY_MS = 1_000;

// Heartbeat-only stale detection: heartbeats prove the socket is alive but carry
// no data. After this many consecutive heartbeats with zero data events (≈60s at
// 5s heartbeats) we check conversation status via API — covers the case where
// another tab already consumed the terminal completed/end events.
const HEARTBEAT_ONLY_THRESHOLD = 12;

// Default token-flush cadence (foundation-standards §5: 50–80ms).
const DEFAULT_FLUSH_INTERVAL_MS = 60;

/** Frozen SSR/initial snapshot — a stable reference for `getServerSnapshot`. */
const INITIAL_SNAPSHOT: ChatEngineSnapshot = Object.freeze({
  messages: Object.freeze([]) as readonly EngineMessage[],
  isStreaming: false,
  isCancelling: false,
  isLoadingHistory: false,
  conversationId: null,
  conversationTitle: null,
  error: null,
});

/** Boundary parse — returns null on malformed data instead of throwing (a v1
 *  edge-case tightening: a bad frame skips its handler rather than bubbling). */
function parseEvent<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Build a chat engine. All state lives in this closure (mirroring v1's refs 1:1
 * for an easy parity audit); nothing leaks to module scope, so multiple engines
 * (e.g. StrictMode double-mount) never share state.
 */
export function createChatEngine(config: ChatEngineConfig): ChatEngine {
  const getToken = config.getToken;
  const flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const commitFn = config.commit ?? ((fn: () => void) => fn());

  // Hot-swappable callbacks + mode resolvers. The React adapter pushes the latest
  // set via `updateHandlers` each render, so a single long-lived engine always
  // fires the freshest handler. Read at event time — never captured per-listener.
  let handlers: ChatEngineHandlers = config;
  const isConfidential = (id: string | null | undefined) => handlers.isConfidential?.(id) ?? false;
  const isRedacted = (id: string | null | undefined) => handlers.isRedacted?.(id) ?? false;

  // ── Structural store (the useSyncExternalStore surface) ──
  let state: ChatEngineSnapshot = INITIAL_SNAPSHOT;
  const structuralListeners = new Set<() => void>();
  function notifyStructural() {
    structuralListeners.forEach((l) => l());
  }
  function setState(updater: (prev: ChatEngineSnapshot) => ChatEngineSnapshot) {
    const next = updater(state);
    if (next === state) return;
    state = next;
    // Commit through the injected wrapper (adapter passes startTransition). Per
    // React RFC 0214 this is inert for external-store updates, but honors §5 and
    // stays forward-compatible; the flush cadence is the real non-blocking lever.
    commitFn(notifyStructural);
  }
  function setMessages(fn: (msgs: readonly EngineMessage[]) => EngineMessage[]) {
    setState((prev) => ({ ...prev, messages: fn(prev.messages) }));
  }

  // ── Per-message live streaming-text store ──
  // liveText = authoritative accumulator (updated synchronously per delta, read by
  // every terminal path). The SMOOTHER owns what subscribers actually see: it reveals
  // liveText's already-arrived characters at an even, backlog-proportional cadence
  // (see stream-smoother.ts) instead of mirroring the provider's bursts. liveText is
  // never touched by it — smoothing is presentation only.
  const liveText = new Map<string, string>();
  const textListeners = new Map<string, Set<() => void>>();
  function notifyText(id: string) {
    textListeners.get(id)?.forEach((l) => l());
  }
  const textSmoother = createStreamSmoother({
    onPublish: notifyText,
    commit: (fn) => commitFn(fn),
    config: config.smoothing,
    disabledIntervalMs: flushIntervalMs,
  });
  function seedText(id: string, text: string) {
    // Seed / reset / accumulated-text replay must appear instantly (no typewriter).
    liveText.set(id, text);
    textSmoother.snap(id, text);
  }
  function appendText(id: string, delta: string) {
    liveText.set(id, (liveText.get(id) ?? '') + delta);
    textSmoother.setTarget(id, liveText.get(id)!);
  }
  function clearText(id: string) {
    liveText.delete(id);
    textSmoother.drop(id);
  }
  const streamingText: StreamingSource = {
    subscribe(id, listener) {
      let set = textListeners.get(id);
      if (!set) {
        set = new Set();
        textListeners.set(id, set);
      }
      set.add(listener);
      return () => {
        set!.delete(listener);
        if (set!.size === 0) textListeners.delete(id);
      };
    },
    get: (id) => textSmoother.get(id),
  };

  // ── Per-message live reasoning store (§C thinking upgrade) ──
  // Reasoning tokens arrive keyed by iteration and often BEFORE the answer
  // placeholder exists, so they are buffered by iteration and associated with the
  // placeholder id once it is created.
  const reasoningByIteration = new Map<number, { text: string; startedAt: number }>();
  const reasoningListeners = new Map<string, Set<() => void>>();
  const messageIdToIteration = new Map<string, number>();
  function notifyReasoning(id: string) {
    reasoningListeners.get(id)?.forEach((l) => l());
  }
  // Reasoning shares the same smoothing policy as answer text (consistency: a jerky
  // reasoning box next to a smooth answer would read as two different systems). Its
  // authoritative text still lives in reasoningByIteration; the smoother only paces
  // the reveal, keyed by message id.
  const reasoningSmoother = createStreamSmoother({
    onPublish: notifyReasoning,
    commit: (fn) => commitFn(fn),
    config: config.smoothing,
    disabledIntervalMs: flushIntervalMs,
  });
  const reasoning: StreamingSource = {
    subscribe(id, listener) {
      let set = reasoningListeners.get(id);
      if (!set) {
        set = new Set();
        reasoningListeners.set(id, set);
      }
      set.add(listener);
      return () => {
        set!.delete(listener);
        if (set!.size === 0) reasoningListeners.delete(id);
      };
    },
    get: (id) => reasoningSmoother.get(id),
  };
  // Feed the latest reasoning target for a message id into the smoother (called when
  // a `thinking` delta lands or a placeholder adopts already-buffered reasoning).
  function pushReasoning(id: string, iteration: number) {
    reasoningSmoother.setTarget(id, reasoningByIteration.get(iteration)?.text ?? '');
  }
  // Finalize a message's reasoning: snapshot it onto the structural message and
  // clear the live buffer. Returns the trace to merge into the finalized message.
  function takeReasoning(id: string): ReasoningTrace {
    const iteration = messageIdToIteration.get(id);
    const entry = iteration !== undefined ? reasoningByIteration.get(iteration) : undefined;
    reasoningSmoother.drop(id);
    if (iteration !== undefined) reasoningByIteration.delete(iteration);
    if (entry && entry.text.trim()) {
      return { reasoning: entry.text.trim(), reasoningMs: Date.now() - entry.startedAt };
    }
    return {};
  }

  // The per-message publish cadence (the render-storm fix) now lives in the two
  // smoothers above: each drains already-arrived characters into its published value
  // on an rAF cadence and notifies ONLY the affected per-message subscribers, so
  // token arrival still never re-renders the transcript. Both self-terminate when
  // no cursor has backlog and re-arm on the next setTarget (appendText / thinking).

  // ── Connection / resilience state (v1 refs, as closure vars) ──
  let eventSource: EventSource | null = null;
  let watchdog: ReturnType<typeof setInterval> | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let lastEventTime = 0;
  let conversationId: string | null = null;
  let executionId: string | null = null;
  let reconnectCount = 0;
  let consecutiveHeartbeats = 0;
  let staleCheckInFlight = false;
  let dedupKeys = new Set<number>();
  // v2_stream token-streaming placeholder tracking (per v1):
  let streamingMessageId: string | null = null;
  let currentIteration: number | null = null;
  // Sub-agent streaming: agent_slug → the active HandoverMessage id whose live
  // text store the specialist's tokens flow into (replaces v1's structural
  // per-token streamingContent writes — same data, no list storm).
  const agentSlugToMessageId = new Map<string, string>();
  // Stream mode + jurisdiction persisted so retry replays the same selection.
  let streamMode: 'v2_stream' | undefined;
  let jurisdiction: JurisdictionChoice = { mode: 'auto' };
  // Tool-call queue: tool name → ordered pending message ids (FIFO match so
  // tool_complete updates the right row when a tool is called repeatedly).
  const toolCallQueue = new Map<string, string[]>();
  // Ref-based cancel guard — immune to React batching / stale closures.
  let isCancelling = false;
  let disposed = false;

  // ─── Message builders (ported from v1) ─────────────────────────────────────

  function addUserMessage(
    content: string,
    attachments?: MessageAttachment[] | MessageAttachment,
  ): EngineMessage {
    const list: MessageAttachment[] | undefined = Array.isArray(attachments)
      ? attachments
      : attachments
        ? [attachments]
        : undefined;
    const message: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      ...(list && list.length > 0 && { attachments: list, attachment: list[0] }),
    };
    setMessages((msgs) => [...msgs, message]);
    setState((prev) => ({ ...prev, error: null }));
    return message;
  }

  function removeMessage(messageId: string) {
    setMessages((msgs) => msgs.filter((m) => m.id !== messageId));
  }

  // Append a finished assistant message (legacy / non-v2_stream completion path).
  function addAssistantMessage(content: string): string {
    const id = generateId();
    setMessages((msgs) => [
      ...msgs,
      { id, role: 'assistant', content, timestamp: new Date(), isStreaming: false },
    ]);
    return id;
  }

  // v2_stream: ensure a streaming assistant placeholder exists for `iteration`. A
  // NEW iteration always creates a fresh placeholder so iteration transitions stay
  // visible in history (iteration-1 text is kept above iteration-2 tool calls).
  function ensureStreamingPlaceholder(iteration: number): string {
    if (currentIteration !== iteration) {
      currentIteration = iteration;
      const id = generateId();
      streamingMessageId = id;
      messageIdToIteration.set(id, iteration);
      seedText(id, '');
      // If reasoning tokens for this iteration already arrived, light up the
      // placeholder's live reasoning immediately.
      if (reasoningByIteration.has(iteration)) {
        pushReasoning(id, iteration);
      }
      setMessages((msgs) => [
        ...msgs,
        { id, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
      ]);
      return id;
    }
    return streamingMessageId!;
  }

  function addErrorMessage(
    errorMsg: string,
    errorCode: string,
    retryable: boolean,
    retryAfterMs: number | null,
  ) {
    const message: ErrorMessage = {
      id: generateId(),
      role: 'assistant',
      content: errorMsg,
      timestamp: new Date(),
      messageType: 'error',
      errorCode,
      retryable,
      retryAfterMs,
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
      error: null,
      isStreaming: false,
      isCancelling: false,
    }));
  }

  function addToolMessage(toolCall: ToolCallingEvent): string {
    const id = generateId();
    const toolMessage: ToolMessage = {
      id,
      role: 'tool',
      content: `Calling ${toolCall.tool_call.name}...`,
      timestamp: new Date(),
      toolName: toolCall.tool_call.name,
      toolParameters: toolCall.tool_call.parameters,
      toolStatus: 'calling',
      agentSlug: toolCall.agent_slug,
    };
    setMessages((msgs) => [...msgs, toolMessage]);
    return id;
  }

  function addHandoverMessage(event: HandoverStartedEvent): string {
    const id = generateId();
    const handoverMsg: HandoverMessage = {
      id,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      messageType: 'handover',
      agentSlug: event.agent_slug,
      task: event.query,
      handoverStatus: 'active',
      handoverType: event.handover_type || 'consult',
    };
    // Route this specialist's future text_delta tokens into this row's live store.
    agentSlugToMessageId.set(event.agent_slug, id);
    seedText(id, '');
    setMessages((msgs) => [...msgs, handoverMsg]);
    return id;
  }

  function updateHandoverMessage(event: HandoverCompleteEvent) {
    const id = agentSlugToMessageId.get(event.agent_slug);
    agentSlugToMessageId.delete(event.agent_slug);
    if (id) clearText(id); // stop the specialist's live streaming box
    setMessages((msgs) =>
      msgs.map((msg) => {
        const ho = msg as HandoverMessage;
        if (
          ho.messageType === 'handover' &&
          ho.agentSlug === event.agent_slug &&
          ho.handoverStatus === 'active'
        ) {
          return {
            ...msg,
            handoverStatus: 'complete',
            latencyMs: event.latency_ms,
            success: event.success,
            handoverResultContent: event.content || event.response_preview || undefined,
            streamingContent: undefined,
          } as HandoverMessage;
        }
        return msg;
      }),
    );
  }

  function updateToolMessage(msgId: string, event: ToolCompleteEvent) {
    setMessages((msgs) =>
      msgs.map((msg) =>
        msg.id === msgId
          ? ({
              ...msg,
              content: `${event.tool_call.name} completed`,
              toolResult: event.tool_result,
              toolStatus: 'complete',
              latencyMs: event.latency_ms,
            } as ToolMessage)
          : msg,
      ),
    );
  }

  // Merge missed messages from the status endpoint: replace any SSE-originated
  // messages after the last user message with the authoritative API messages.
  function mergeMissedMessages(apiMessages: ApiMessage[]) {
    if (apiMessages.length === 0) return;
    const transformed = transformApiMessages(apiMessages);
    setState((prev) => {
      const lastUserIdx = [...prev.messages].reverse().findIndex((m) => m.role === 'user');
      if (lastUserIdx === -1) {
        return {
          ...prev,
          messages: [...prev.messages, ...transformed],
          isStreaming: false,
          isCancelling: false,
          error: null,
        };
      }
      const cutIndex = prev.messages.length - lastUserIdx;
      return {
        ...prev,
        messages: [...prev.messages.slice(0, cutIndex), ...transformed],
        isStreaming: false,
        isCancelling: false,
        error: null,
      };
    });
  }

  // ─── Polling ────────────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // Poll status until no longer pending, then reload the full conversation so all
  // messages (tool calls, handovers, response) are present after recovery.
  function pollForCompletion(convId: string) {
    stopPolling();
    const startTime = Date.now();
    pollInterval = setInterval(async () => {
      if (Date.now() - startTime > POLL_MAX_DURATION_MS) {
        stopPolling();
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isCancelling: false,
          error: 'Response timed out. Please try again.',
        }));
        return;
      }
      try {
        const response = await chatApi.getStatus(convId);
        if (response.data.status !== 'pending') {
          stopPolling();
          try {
            const conv = await chatApi.getConversation(convId);
            if (conv.success && conv.data.messages) {
              const transformed = transformApiMessages(conv.data.messages);
              setState((prev) => ({
                ...prev,
                messages: transformed,
                conversationTitle: conv.data.title || prev.conversationTitle,
                isStreaming: false,
                isCancelling: false,
                error: null,
              }));
              handlers.onHistoryLoaded?.(conv.data);
            } else {
              setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
            }
          } catch {
            setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
          }
        }
      } catch {
        // Transient failure — keep polling.
      }
    }, POLL_INTERVAL_MS);
  }

  // ─── Watchdog ─────────────────────────────────────────────────────────────

  function stopWatchdog() {
    if (watchdog) {
      clearInterval(watchdog);
      watchdog = null;
    }
  }

  function startWatchdog() {
    stopWatchdog();
    lastEventTime = Date.now();
    watchdog = setInterval(() => {
      if (Date.now() - lastEventTime > WATCHDOG_SILENCE_MS) {
        stopWatchdog();
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Try SSE reconnection first; it falls back to polling after max retries.
        reconnectStream();
      }
    }, WATCHDOG_CHECK_MS);
  }

  // ─── Stale-stream check ──────────────────────────────────────────────────────
  // SSE alive (heartbeats flowing) but no data — e.g. another tab already consumed
  // the terminal events. Confirm via status and finalize from the DB if finished.
  async function checkStaleStream() {
    const convId = conversationId;
    if (!convId || staleCheckInFlight) return;
    staleCheckInFlight = true;
    try {
      const response = await chatApi.getStatus(convId);
      if (response.data.status !== 'pending') {
        stopWatchdog();
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        executionId = null;
        try {
          const conv = await chatApi.getConversation(convId);
          if (conv.success && conv.data.messages) {
            const transformed = transformApiMessages(conv.data.messages);
            setState((prev) => ({
              ...prev,
              messages: transformed,
              conversationTitle: conv.data.title || prev.conversationTitle,
              isStreaming: false,
              isCancelling: false,
              error: null,
            }));
            handlers.onHistoryLoaded?.(conv.data);
          } else {
            setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
          }
        } catch {
          setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
        }
      }
      consecutiveHeartbeats = 0;
    } catch {
      consecutiveHeartbeats = 0;
    } finally {
      staleCheckInFlight = false;
    }
  }

  // ─── History loading ────────────────────────────────────────────────────────

  async function loadConversationHistory(convId: string) {
    setState((prev) => ({ ...prev, isLoadingHistory: true, error: null, conversationId: convId }));
    conversationId = convId;
    try {
      const response = await chatApi.getConversation(convId);
      if (response.success && response.data.messages) {
        const apiMessages = response.data.messages;
        const transformedMessages = transformApiMessages(apiMessages);
        // Build the seq dedup set from history — collision-free dedup for SSE
        // reconnect (skip events already rendered from persisted messages).
        const dedup = new Set<number>();
        for (const msg of apiMessages) {
          const seq = msg.metadata?.seq;
          if (seq !== undefined) dedup.add(seq);
        }
        dedupKeys = dedup;
        setState((prev) => ({
          ...prev,
          messages: transformedMessages,
          conversationTitle: response.data.title || null,
          isLoadingHistory: false,
        }));
        handlers.onHistoryLoaded?.(response.data);
      } else {
        setState((prev) => ({
          ...prev,
          error: response.message || 'Failed to load conversation',
          isLoadingHistory: false,
        }));
      }
    } catch (err) {
      // Detect 404 specifically so the screen can show a "not available" state.
      const status = (err as { response?: { status?: number } })?.response?.status;
      const errorMsg =
        status === 404
          ? 'not_found'
          : err instanceof Error
            ? err.message
            : 'Failed to load conversation';
      setState((prev) => ({ ...prev, error: errorMsg, isLoadingHistory: false }));
      handlers.onError?.(errorMsg);
    }
  }

  // Confidential sibling of loadConversationHistory — confidential conversations
  // 404 from the server by design, so history comes from IndexedDB. Returns true
  // if a transcript was found, false on a cold-load (wiped / new device).
  async function loadConversationHistoryFromIDB(convId: string): Promise<boolean> {
    setState((prev) => ({ ...prev, isLoadingHistory: true, error: null, conversationId: convId }));
    conversationId = convId;
    try {
      const transcript = await getTranscript(convId);
      if (!transcript) {
        setState((prev) => ({
          ...prev,
          messages: [],
          isLoadingHistory: false,
          error: 'confidential_transcript_lost',
        }));
        return false;
      }
      // Prune-on-open (§A7-39, 1c): a confidential upload is deleted server-side
      // after 24h, so attachment references past their `expires_at` are dropped
      // here rather than rendered as if the file still exists. Captured once as an
      // action value (never in a render path). Non-destructive to IDB — the filter
      // is at map time; the stored transcript TEXT is never touched (the owner copy
      // promises it lives "until you delete it").
      const now = Date.now();
      const messages: EngineMessage[] = transcript.messages.map((m, idx) => {
        const live = (m.attachments ?? []).filter(
          (a) => !isConfidentialAttachmentExpired(a.expires_at, now),
        );
        const list: MessageAttachment[] | undefined =
          live.length > 0
            ? live.map((a) => ({
                file_id: a.file_id,
                file_name: a.file_name,
                file_size: a.file_size,
              }))
            : undefined;
        return {
          id: `${m.local_id}_${idx}`,
          role: m.role === 'tool' ? 'assistant' : m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          ...(list && { attachments: list, attachment: list[0] }),
        } as ChatMessage;
      });
      setState((prev) => ({
        ...prev,
        messages,
        conversationTitle: transcript.title ?? prev.conversationTitle,
        isLoadingHistory: false,
      }));
      return true;
    } catch {
      setState((prev) => ({ ...prev, isLoadingHistory: false, error: 'confidential_transcript_lost' }));
      return false;
    }
  }

  async function fetchConversationTitle(convId: string) {
    try {
      const response = await chatApi.getConversation(convId);
      if (response.success && response.data.title) {
        setState((prev) => ({ ...prev, conversationTitle: response.data.title }));
      }
    } catch {
      // Silently fail — title is not critical.
    }
  }

  // ─── SSE stream connection ──────────────────────────────────────────────────

  function connectToStream(
    execId: string,
    initialMessage?: string,
    initialAttachments?: MessageAttachment[] | MessageAttachment,
  ) {
    const token = getToken();
    if (!token) {
      const error = 'Authentication required';
      setState((prev) => ({ ...prev, error }));
      handlers.onError?.(error);
      return;
    }
    // Prevent multiple simultaneous connections.
    if (eventSource) {
      console.warn('Already connected to a stream, ignoring duplicate connection');
      return;
    }

    if (initialMessage) addUserMessage(initialMessage, initialAttachments);

    // Streaming — no assistant placeholder yet (created on the first text_delta).
    setState((prev) => ({ ...prev, isStreaming: true, isCancelling: false, error: null }));
    executionId = execId;

    const encodedToken = encodeURIComponent(token);
    const streamUrl = `${API_BASE_URL}/api/chat/stream/${execId}?token=${encodedToken}`;
    const es = new EventSource(streamUrl);
    eventSource = es;
    startWatchdog();

    // Snapshot the dedup set built from history — skip SSE events already rendered.
    const dedup = dedupKeys;
    const resetHeartbeat = () => {
      consecutiveHeartbeats = 0;
    };

    // connected — on reconnect the backend may replay `accumulated_text` so the
    // user sees no gap after a refresh mid-stream.
    es.addEventListener('connected', (e) => {
      lastEventTime = Date.now();
      reconnectCount = 0; // reset on successful connection
      resetHeartbeat();
      const data = parseEvent<ConnectedEvent>((e as MessageEvent).data);
      if (data?.accumulated_text) {
        const iteration = currentIteration ?? 0;
        const msgId = ensureStreamingPlaceholder(iteration);
        seedText(msgId, data.accumulated_text);
        setMessages((msgs) =>
          msgs.map((m) => (m.id === msgId ? { ...m, content: data.accumulated_text! } : m)),
        );
      }
      handlers.onConnected?.();
    });

    es.addEventListener('iteration', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<IterationEvent>((e as MessageEvent).data);
      if (event) handlers.onIteration?.(event);
    });

    es.addEventListener('handover_started', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<HandoverStartedEvent>((e as MessageEvent).data);
      if (!event) return;
      if (event.seq !== undefined && dedup.has(event.seq)) return;
      addHandoverMessage(event);
    });

    es.addEventListener('handover_complete', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<HandoverCompleteEvent>((e as MessageEvent).data);
      if (!event) return;
      if (event.seq !== undefined && dedup.has(event.seq)) return;
      updateHandoverMessage(event);
    });

    // tool_calling — add a tool row and queue its id by tool name so tool_complete
    // matches correctly even with duplicate tool names. Internal `_handover` tool
    // calls are skipped (not user-visible).
    es.addEventListener('tool_calling', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<ToolCallingEvent>((e as MessageEvent).data);
      if (!event) return;
      if (event.seq !== undefined && dedup.has(event.seq)) return;
      if (event.tool_call.name === '_handover') return;
      const msgId = addToolMessage(event);
      const name = event.tool_call.name;
      const queue = toolCallQueue.get(name) || [];
      queue.push(msgId);
      toolCallQueue.set(name, queue);
      handlers.onToolCalling?.(event);
    });

    // tool_complete — consume the first pending id for this tool name (FIFO).
    es.addEventListener('tool_complete', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<ToolCompleteEvent>((e as MessageEvent).data);
      if (!event) return;
      if (event.seq !== undefined && dedup.has(event.seq)) return;
      if (event.tool_call.name === '_handover') return;
      const name = event.tool_call.name;
      const queue = toolCallQueue.get(name) || [];
      const msgId = queue.shift();
      if (msgId) {
        toolCallQueue.set(name, queue);
        updateToolMessage(msgId, event);
      }
      handlers.onToolComplete?.(event);
    });

    // text_delta — token-level text. NEVER dedup on seq (deltas are ephemeral and
    // seq is a shared monotonic counter). agent_slug present ⇒ sub-agent text
    // (into the handover row's live store); else orchestrator text (into the
    // placeholder's live store). Both buffer + flush; no per-token setState.
    es.addEventListener('text_delta', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<TextDeltaEvent>((e as MessageEvent).data);
      if (!event) return;
      if (event.agent_slug) {
        const id = agentSlugToMessageId.get(event.agent_slug);
        if (id) appendText(id, event.delta);
      } else {
        const msgId = ensureStreamingPlaceholder(event.iteration);
        appendText(msgId, event.delta);
      }
    });

    // text_done — text stream finished for this iteration. Stop the cursor but
    // keep content visible; `completed` will replace it with authoritative text.
    es.addEventListener('text_done', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<TextDoneEvent>((e as MessageEvent).data);
      if (!event) return;
      if (event.agent_slug) return; // only stop the orchestrator cursor here

      const msgId = streamingMessageId;
      if (msgId) {
        const finalText = liveText.get(msgId) ?? '';
        setMessages((msgs) =>
          msgs.map((m) => (m.id === msgId ? { ...m, content: finalText, isStreaming: false } : m)),
        );
        // text_done = "the answer text is complete": reveal it in full now (the row
        // already reads message.content once isStreaming flips false, so this is
        // visually identical) and retire the smoothing cursor so it stops ticking
        // in the gap before `completed`. No trailing typewriter after the answer ends.
        textSmoother.snap(msgId, finalText);
      }

      // Confidential: persist the orchestrator's accumulated text the moment
      // text_done fires — the device's one shot before the server discards it.
      // The later `completed` write idempotently updates the same row.
      const convId = conversationId;
      if (convId && isConfidential(convId) && msgId) {
        const accumulated = liveText.get(msgId) ?? '';
        if (accumulated.trim()) void appendAssistantTurn(convId, accumulated).catch(() => {});
      }
    });

    // text_reset — the model retried this iteration's text. Clears the accumulator.
    // Carries the narration-vs-final heuristic (see below).
    es.addEventListener('text_reset', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const event = parseEvent<TextResetEvent>((e as MessageEvent).data);
      if (!event) return;

      if (event.agent_slug) {
        // Capture sub-agent narration before clearing its buffer.
        const id = agentSlugToMessageId.get(event.agent_slug);
        const currentText = id ? liveText.get(id) ?? '' : '';
        if (currentText.trim()) handlers.onNarration?.(currentText.trim(), event.agent_slug);
        if (id) seedText(id, '');
        return;
      }

      const msgId = streamingMessageId;
      const currentText = msgId ? liveText.get(msgId) ?? '' : '';
      // Option A heuristic: the backend emits text_type:"response" for inter-tool
      // narration too, so text_type alone misclassifies narration as a final
      // answer. The real discriminator is reason:"tool_call" — a genuine final
      // response is terminated by text_done, never by text_reset with
      // reason:"tool_call". (Track for backend: persist metadata.type "narration".)
      const isFinalResponse = event.text_type === 'response' && event.reason !== 'tool_call';

      if (isFinalResponse && currentText.trim() && msgId && currentIteration === event.iteration) {
        // The orchestrator's real answer — finalize the placeholder in place and
        // detach refs so the next iteration creates a fresh one.
        const trace = takeReasoning(msgId);
        setMessages((msgs) =>
          msgs.map((m) =>
            m.id === msgId ? { ...m, content: currentText, isStreaming: false, ...trace } : m,
          ),
        );
        clearText(msgId);
        messageIdToIteration.delete(msgId);
        streamingMessageId = null;
        currentIteration = null;
        return;
      }

      // Narration text: show transiently via onNarration.
      if (currentText.trim() && !isFinalResponse) handlers.onNarration?.(currentText.trim());

      // Narration reset (or empty response): clear accumulator and remove the
      // placeholder so an empty bubble never flashes before the next iteration.
      if (msgId && currentIteration === event.iteration) {
        clearText(msgId);
        takeReasoning(msgId);
        messageIdToIteration.delete(msgId);
        setMessages((msgs) => msgs.filter((m) => m.id !== msgId));
        streamingMessageId = null;
        currentIteration = null;
      }
    });

    // heartbeat — socket alive but no data. Track consecutive heartbeats; over the
    // threshold, verify the AI actually finished (another tab may have consumed
    // the terminal events).
    es.addEventListener('heartbeat', () => {
      lastEventTime = Date.now();
      consecutiveHeartbeats += 1;
      if (consecutiveHeartbeats >= HEARTBEAT_ONLY_THRESHOLD) void checkStaleStream();
    });

    // thinking — the model is actively reasoning. Reset the stale-detection
    // counters so the watchdog/heartbeat checks don't falsely trigger, AND (NEW,
    // §C upgrade) accumulate any reasoning tokens the event carries. v1 discarded
    // these; here they feed the per-message reasoning trace. The token field is
    // read defensively because the backend's thinking payload shape is still
    // firming up — whichever text field is present is captured; none ⇒ no-op.
    es.addEventListener('thinking', (e) => {
      lastEventTime = Date.now();
      resetHeartbeat();
      const data = parseEvent<{
        iteration?: number;
        delta?: string;
        text?: string;
        thinking?: string;
        content?: string;
      }>((e as MessageEvent).data);
      if (!data) return;
      const text = data.delta ?? data.text ?? data.thinking ?? data.content ?? '';
      if (!text) return;
      const iteration = data.iteration ?? currentIteration ?? 0;
      const entry = reasoningByIteration.get(iteration) ?? { text: '', startedAt: Date.now() };
      entry.text += text;
      reasoningByIteration.set(iteration, entry);
      // If the answer placeholder for this iteration already exists, stream the
      // reasoning live into it (paced by the reasoning smoother).
      if (streamingMessageId && currentIteration === iteration) {
        pushReasoning(streamingMessageId, iteration);
      }
    });

    // completed — for v2_stream, replace the streaming placeholder with the
    // authoritative content; for legacy, append a new assistant message.
    es.addEventListener('completed', (e) => {
      lastEventTime = Date.now();
      const event = parseEvent<CompletedEvent>((e as MessageEvent).data);
      if (!event) return;
      if (event.seq !== undefined && dedup.has(event.seq)) return;

      const convId = conversationId;
      const confidential = !!convId && isConfidential(convId);
      const finalText = event.content ?? event.message ?? '';

      // replayable === false: the server discarded content (confidential mode /
      // late connect / DB replay). Fall back to the local transcript — never a
      // blank bubble.
      if (event.replayable === false && confidential && convId) {
        void (async () => {
          try {
            const transcript = await getTranscript(convId);
            const lastAssistant = transcript?.messages
              .filter((m) => m.role === 'assistant')
              .slice(-1)[0];
            if (lastAssistant && lastAssistant.content) {
              const placeholderId = streamingMessageId;
              if (placeholderId) {
                const trace = takeReasoning(placeholderId);
                setMessages((msgs) =>
                  msgs.map((m) =>
                    m.id === placeholderId
                      ? { ...m, content: lastAssistant.content, isStreaming: false, ...trace }
                      : m,
                  ),
                );
                clearText(placeholderId);
                messageIdToIteration.delete(placeholderId);
                streamingMessageId = null;
                currentIteration = null;
              } else {
                addAssistantMessage(lastAssistant.content);
              }
            } else {
              addErrorMessage(
                'This confidential conversation has ended on this device.',
                'TRANSCRIPT_LOST',
                false,
                null,
              );
            }
          } catch {
            addErrorMessage(
              'This confidential conversation has ended on this device.',
              'TRANSCRIPT_LOST',
              false,
              null,
            );
          }
        })();
        handlers.onCompleted?.(event);
        return;
      }

      // Confidential live path: persist the final content (idempotent with the
      // text_done write — appendAssistantTurn updates the last assistant row).
      if (confidential && convId && finalText.trim()) {
        void appendAssistantTurn(convId, finalText).catch(() => {});
      }

      const placeholderId = streamingMessageId;
      if (placeholderId) {
        const trace = takeReasoning(placeholderId);
        setMessages((msgs) =>
          msgs.map((m) => {
            if (m.id === placeholderId) {
              return { ...m, content: finalText, isStreaming: false, ...trace };
            }
            // Clear handoverResultContent when the final response duplicates it —
            // common with Writer agents whose output becomes the final text.
            const ho = m as HandoverMessage;
            if (ho.messageType === 'handover' && ho.handoverResultContent && ho.handoverResultContent.length > 50) {
              const hoContent = ho.handoverResultContent;
              if (finalText.includes(hoContent) || hoContent.includes(finalText)) {
                return { ...m, handoverResultContent: undefined } as HandoverMessage;
              }
            }
            return m;
          }),
        );
        clearText(placeholderId);
        messageIdToIteration.delete(placeholderId);
        streamingMessageId = null;
        currentIteration = null;
        resetStreamingBuffers();
      } else {
        addAssistantMessage(finalText);
      }
      handlers.onCompleted?.(event);
    });

    // error (WITH data) — real backend error OR a CANCELLED confirmation. Browser
    // connection errors fire this listener with NO data and are left to onerror.
    es.addEventListener('error', (e) => {
      const data = (e as MessageEvent).data;
      if (!data) return; // connection error — handled by onerror

      lastEventTime = Date.now();
      stopWatchdog();

      const parsed = parseEvent<{
        error_code?: string;
        error_message?: string;
        message?: string;
        retryable?: boolean;
        retry_after_ms?: number | null;
      }>(data);

      // Close BEFORE branching so onerror's identity guard trips regardless of
      // branch. Clear executionId as defense against an orphan reconnect.
      es.close();
      eventSource = null;
      executionId = null;
      isCancelling = false;
      toolCallQueue.clear();

      // CANCELLED: user-initiated stop — NOT an error. Keep the placeholder's
      // partial text visible (matches ChatGPT/Claude cancel behavior).
      if (parsed?.error_code === 'CANCELLED') {
        const placeholderId = streamingMessageId;
        if (placeholderId) {
          const finalText = liveText.get(placeholderId) ?? '';
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === placeholderId ? { ...m, content: finalText, isStreaming: false } : m,
            ),
            isStreaming: false,
            isCancelling: false,
          }));
          clearText(placeholderId);
          messageIdToIteration.delete(placeholderId);
          streamingMessageId = null;
          currentIteration = null;
        } else {
          setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
        }
        resetStreamingBuffers();
        return;
      }

      // Real error — render inline.
      if (parsed) {
        const errorMsg = parsed.error_message || parsed.message || 'Something went wrong';
        const errorCode = parsed.error_code || 'UNKNOWN';
        const retryable = parsed.retryable ?? false;
        const retryAfterMs = parsed.retry_after_ms ?? null;
        addErrorMessage(errorMsg, errorCode, retryable, retryAfterMs);
        handlers.onError?.(errorMsg);
      } else {
        const errorMsg = 'Stream error';
        setState((prev) => ({ ...prev, error: errorMsg, isStreaming: false, isCancelling: false }));
        handlers.onError?.(errorMsg);
      }
    });

    // cancelled — backend-confirmed user stop. Keep partial text.
    es.addEventListener('cancelled', () => {
      stopWatchdog();
      es.close();
      eventSource = null;
      executionId = null;
      isCancelling = false;
      toolCallQueue.clear();
      const placeholderId = streamingMessageId;
      if (placeholderId) {
        const finalText = liveText.get(placeholderId) ?? '';
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === placeholderId ? { ...m, content: finalText, isStreaming: false } : m,
          ),
          isStreaming: false,
          isCancelling: false,
        }));
        clearText(placeholderId);
        messageIdToIteration.delete(placeholderId);
        streamingMessageId = null;
        currentIteration = null;
      } else {
        setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
      }
      resetStreamingBuffers();
    });

    // end — terminal. Finalize any placeholder left open.
    es.addEventListener('end', () => {
      stopWatchdog();
      es.close();
      eventSource = null;
      isCancelling = false;
      toolCallQueue.clear();
      const placeholderId = streamingMessageId;
      if (placeholderId) {
        const finalText = liveText.get(placeholderId) ?? '';
        const trace = takeReasoning(placeholderId);
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === placeholderId ? { ...m, content: finalText || m.content, isStreaming: false, ...trace } : m,
          ),
          isStreaming: false,
          isCancelling: false,
        }));
        clearText(placeholderId);
        messageIdToIteration.delete(placeholderId);
        streamingMessageId = null;
        currentIteration = null;
      } else {
        setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
      }
      resetStreamingBuffers();
    });

    // timeout — terminal. Finalize any placeholder and tag partial timeout.
    es.addEventListener('timeout', () => {
      stopWatchdog();
      isCancelling = false;
      toolCallQueue.clear();
      const errorMsg = 'Stream timed out';
      const placeholderId = streamingMessageId;
      if (placeholderId) {
        const finalText = liveText.get(placeholderId) ?? '';
        const trace = takeReasoning(placeholderId);
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) => {
            if (m.id !== placeholderId) return m;
            const content = finalText || m.content;
            return {
              ...m,
              content,
              isStreaming: false,
              ...trace,
              ...(content ? { partial: { reason: 'timeout' as const } } : {}),
            };
          }),
          error: errorMsg,
          isStreaming: false,
          isCancelling: false,
        }));
        clearText(placeholderId);
        messageIdToIteration.delete(placeholderId);
        streamingMessageId = null;
        currentIteration = null;
      } else {
        setState((prev) => ({ ...prev, error: errorMsg, isStreaming: false, isCancelling: false }));
      }
      resetStreamingBuffers();
      handlers.onError?.(errorMsg);
      es.close();
      eventSource = null;
    });

    // Connection errors. Let the browser auto-reconnect while it can (it sends
    // Last-Event-ID so the backend replays missed events). Only intervene when the
    // EventSource is permanently CLOSED (readyState 2).
    es.onerror = () => {
      if (eventSource !== es) return;
      if (es.readyState === 0) return; // CONNECTING — browser is auto-reconnecting
      stopWatchdog();
      es.close();
      eventSource = null;
      reconnectStream();
    };
  }

  // Clear the streaming accumulators at the end of a turn (v1 cleared
  // textByIteration + agentText). Structural rows are already finalized, so no
  // notify is needed here.
  function resetStreamingBuffers() {
    textSmoother.clear();
    reasoningSmoother.clear();
    liveText.clear();
    reasoningByIteration.clear();
    agentSlugToMessageId.clear();
    messageIdToIteration.clear();
  }

  // ─── SSE reconnection ───────────────────────────────────────────────────────
  // Reconnect the live stream before falling back to polling.
  function reconnectStream() {
    const execId = executionId;
    const convId = conversationId;
    if (!execId || reconnectCount >= SSE_MAX_RECONNECTS) {
      reconnectCount = 0;
      if (convId) {
        pollForCompletion(convId);
      } else {
        setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: 'Connection lost' }));
      }
      return;
    }
    reconnectCount += 1;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    // Brief delay before reconnecting to avoid hammering the server.
    setTimeout(() => {
      if (!executionId) return; // intentionally closed during the delay
      connectToStream(executionId);
    }, SSE_RECONNECT_DELAY_MS);
  }

  // ─── Simple actions ─────────────────────────────────────────────────────────

  function setConversationId(id: string) {
    conversationId = id;
    setState((prev) => ({ ...prev, conversationId: id }));
  }

  function disconnect() {
    stopWatchdog();
    stopPolling();
    textSmoother.clear();
    reasoningSmoother.clear();
    executionId = null;
    reconnectCount = 0;
    consecutiveHeartbeats = 0;
    dedupKeys = new Set();
    // Clear text accumulators on FULL disconnect (but never on SSE reconnect — the
    // placeholder must persist so `completed` can replace it).
    liveText.clear();
    reasoningByIteration.clear();
    agentSlugToMessageId.clear();
    messageIdToIteration.clear();
    streamingMessageId = null;
    currentIteration = null;
    toolCallQueue.clear();
    isCancelling = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
      setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
    }
  }

  // Graceful cancel — POSTs to the cancel endpoint and waits for a terminal SSE
  // event to finalize. Does NOT close the EventSource locally (a 200 means "cancel
  // accepted", not "stream stopped"; the terminal event is authoritative).
  function cancelStream() {
    const execId = executionId;
    const token = getToken();
    if (!execId || !token) return;
    if (isCancelling) return; // ref-based guard, immune to React batching
    isCancelling = true;
    setState((prev) => ({ ...prev, isCancelling: true }));
    void chatApi.cancelStream(execId, token);
  }

  function clearChat() {
    disconnect();
    conversationId = null;
    jurisdiction = { mode: 'auto' };
    state = INITIAL_SNAPSHOT;
    commitFn(notifyStructural);
  }

  function setError(error: string | null) {
    setState((prev) => ({ ...prev, error }));
  }

  // ─── Send (centralized, with 409/redaction/block/error handling) ────────────

  async function send(message: string, options: SendMessageOptions = {}) {
    if (eventSource) return; // prevent concurrent sends
    dedupKeys = new Set(); // fresh send — no history to dedup against

    const convId = options.conversationId || conversationId;

    const attachmentsList: MessageAttachment[] =
      options.attachments ?? (options.attachment ? [options.attachment] : []);
    const fileIdsList: number[] =
      options.fileIds ?? (options.fileId !== undefined ? [options.fileId] : []);

    // Confidential source of truth is the injected resolver (v1 read the Zustand
    // store). Turn N>1 re-sends the full prior transcript from IndexedDB.
    const isConfidentialTurnN = !!convId && isConfidential(convId);
    // Redacted flag is sticky after turn 1, so it is never re-sent — but we still
    // need to know locally to swap the optimistic user message for the redacted form.
    const isRedactedTurnN = !!convId && isRedacted(convId);

    // Read prior history from IDB BEFORE appending the new user turn.
    let priorHistory: { role: 'user' | 'assistant' | 'tool'; content: string }[] = [];
    if (isConfidentialTurnN && convId) {
      try {
        const transcript = await getTranscript(convId);
        priorHistory = historyEntriesFor(transcript);
      } catch {
        priorHistory = [];
      }
      // Persist the new user turn to IDB BEFORE the POST so a crash can't lose it.
      try {
        await appendUserTurn(convId, {
          content: message,
          ...(attachmentsList.length > 0 && {
            attachments: attachmentsList.map((a) => ({
              file_id: a.file_id,
              file_name: a.file_name,
              file_size: a.file_size,
            })),
          }),
        });
      } catch {
        // Non-fatal — proceed with the POST.
      }
    }

    const optimisticMsg = addUserMessage(message, attachmentsList);
    setState((prev) => ({ ...prev, isStreaming: true, isCancelling: false, error: null }));

    try {
      streamMode = options.streamMode;
      const choice: JurisdictionChoice = options.jurisdiction ?? { mode: 'auto' };
      jurisdiction = choice;

      const baseBody = {
        message,
        stream: true as const,
        ...(convId && { conversation_id: convId }),
        ...(fileIdsList.length > 0 && { file_ids: fileIdsList }),
        ...(options.studyMode && { study_mode: true }),
        ...(options.workflowId && { workflow_id: options.workflowId }),
        ...(options.streamMode && { stream_mode: options.streamMode }),
        // Confidential turn N: re-send the prior transcript. is_confidential is set
        // once at creation (turn 1) and is immutable — never re-sent here.
        ...(isConfidentialTurnN && { messages: priorHistory }),
      };
      const response = await chatApi.start(applyJurisdiction(baseBody, choice));

      if (response.success) {
        // Redacted response carries the canonical (redacted) form of the user turn
        // so the local store stays in sync without a refetch.
        const redactedText = response.data.user_message_content;
        if (isRedactedTurnN && redactedText && redactedText !== message) {
          setMessages((msgs) =>
            msgs.map((m) => (m.id === optimisticMsg.id ? { ...m, content: redactedText } : m)),
          );
          if (isConfidentialTurnN && convId) {
            try {
              await replaceLastUserTurnContent(convId, redactedText);
            } catch {
              // Non-fatal — worst case, next turn sends the raw text.
            }
          }
        }
        connectToStream(response.data.execution_id);
      } else {
        removeMessage(optimisticMsg.id);
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isCancelling: false,
          error: response.message || 'Failed to send message',
        }));
      }
    } catch (err) {
      // 409 PENDING_RESPONSE — a response is already generating.
      if (err instanceof AxiosError && err.response?.status === 409) {
        const responseData = err.response.data as { code?: string; data?: PendingResponseData } | undefined;
        if (responseData?.code === 'PENDING_RESPONSE') {
          removeMessage(optimisticMsg.id);
          const pendingData = responseData.data;
          if (pendingData?.execution_id) {
            connectToStream(pendingData.execution_id);
          } else if (convId) {
            pollForCompletion(convId);
          } else {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              isCancelling: false,
              error: 'A response is still being generated.',
            }));
          }
          return;
        }
      }

      // 503 redaction service unavailable — fail closed, never send raw text.
      if (isRedactedTurnN && err instanceof AxiosError && err.response?.status === 503) {
        removeMessage(optimisticMsg.id);
        const retryAfter = err.response.headers?.['retry-after'];
        const retryMsg = retryAfter
          ? `Redaction service is temporarily unavailable. Try again in ${retryAfter}s.`
          : 'Redaction service is temporarily unavailable. Please try again shortly.';
        setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: retryMsg }));
        return;
      }

      // 429 content duplicate.
      if (err instanceof AxiosError && err.response?.status === 429) {
        removeMessage(optimisticMsg.id);
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isCancelling: false,
          error: 'This message was already sent. Please wait a moment.',
        }));
        return;
      }

      // Server-side block (messages exhausted, account flagged) — inline soft banner.
      const blocked = extractBlockedReason(err);
      if (blocked) {
        removeMessage(optimisticMsg.id);
        addErrorMessage(blocked.message, 'MESSAGES_EXHAUSTED', false, null);
        return;
      }

      // Generic error.
      removeMessage(optimisticMsg.id);
      const errorMsg =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message || 'Failed to send message'
          : 'Network error. Please try again.';
      setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: errorMsg }));
    }
  }

  // ─── Retry (fetch-before-retry with status check) ───────────────────────────

  async function retryLastMessage() {
    if (state.isStreaming || eventSource) return;
    const lastUserMsg = [...state.messages].reverse().find((m) => m.role === 'user');
    const convId = state.conversationId;
    if (!lastUserMsg || !convId) return;

    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => !isErrorMessage(m as ConversationMessage)),
      error: null,
      isStreaming: true,
      isCancelling: false,
    }));

    try {
      const statusResponse = await chatApi.getStatus(convId);
      const status = statusResponse.data;

      if (status.status === 'completed') {
        if (status.messages.length > 0) mergeMissedMessages(status.messages);
        else setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
        return;
      }
      if (status.status === 'pending' && status.execution_id) {
        connectToStream(status.execution_id);
        return;
      }
      if (status.status === 'pending' && !status.execution_id) {
        pollForCompletion(convId);
        return;
      }

      // expired / idle — truly retry, preserving all file attachments.
      const originalMsg = lastUserMsg as ChatMessage;
      const retryAttachments =
        originalMsg.attachments ?? (originalMsg.attachment ? [originalMsg.attachment] : []);
      const retryFileIds = retryAttachments.map((a) => a.file_id);

      const retryBody = {
        message: lastUserMsg.content,
        stream: true as const,
        conversation_id: convId,
        ...(retryFileIds.length > 0 && { file_ids: retryFileIds }),
        ...(streamMode && { stream_mode: streamMode }),
      };
      const response = await chatApi.start(applyJurisdiction(retryBody, jurisdiction));
      if (response.success) {
        connectToStream(response.data.execution_id);
      } else {
        setState((prev) => ({
          ...prev,
          error: response.message || 'Failed to retry',
          isStreaming: false,
          isCancelling: false,
        }));
      }
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 409) {
        const responseData = err.response.data as { code?: string; data?: PendingResponseData } | undefined;
        if (responseData?.code === 'PENDING_RESPONSE' && responseData.data?.execution_id) {
          connectToStream(responseData.data.execution_id);
          return;
        }
      }
      const blocked = extractBlockedReason(err);
      if (blocked) {
        addErrorMessage(blocked.message, 'MESSAGES_EXHAUSTED', false, null);
        return;
      }
      setState((prev) => ({
        ...prev,
        error: 'Failed to retry. Please try again.',
        isStreaming: false,
        isCancelling: false,
      }));
    }
  }

  // ─── Recovery (page reload / direct navigation) ─────────────────────────────

  async function recoverPendingState(convId: string): Promise<RecoverResult> {
    try {
      const response = await chatApi.getStatus(convId);
      const status = response.data;
      if (status.status === 'pending') {
        setState((prev) => ({ ...prev, isStreaming: true, isCancelling: false, error: null }));
        if (status.execution_id) connectToStream(status.execution_id);
        else pollForCompletion(convId);
        return 'reconnected';
      }
      return status.status === 'idle'
        ? 'idle'
        : (status.status as 'completed' | 'failed' | 'expired');
    } catch {
      return 'load_history';
    }
  }

  // ─── Public engine handle ───────────────────────────────────────────────────

  function dispose() {
    if (disposed) return;
    disposed = true;
    disconnect();
    textSmoother.dispose();
    reasoningSmoother.dispose();
    structuralListeners.clear();
    textListeners.clear();
    reasoningListeners.clear();
  }

  return {
    subscribe(listener) {
      structuralListeners.add(listener);
      return () => structuralListeners.delete(listener);
    },
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL_SNAPSHOT,
    streamingText,
    reasoning,
    send,
    connectToStream,
    loadConversationHistory,
    loadConversationHistoryFromIDB,
    fetchConversationTitle,
    setConversationId,
    addUserMessage,
    disconnect,
    cancelStream,
    clearChat,
    setError,
    retryLastMessage,
    recoverPendingState,
    updateHandlers(next) {
      handlers = next;
    },
    dispose,
  };
}
