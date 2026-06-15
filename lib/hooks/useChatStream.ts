'use client';

import { useState, useCallback, useRef } from 'react';
import { AxiosError } from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  isErrorMessage,
  type ChatMessage,
  type ChatState,
  type UseChatStreamOptions,
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
  type ToolMessage,
  type HandoverMessage,
  type ErrorMessage,
  type ApiMessage,
  type ConversationMessage,
  type MessageAttachment,
  type PendingResponseData,
} from '@/types/chat';
import { chatApi } from '@/lib/api/chat';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { applyJurisdiction } from '@/lib/utils/jurisdiction-payload';
import { extractBlockedReason } from '@/lib/utils/api-error';
import { useConfidentialModeStore } from '@/lib/stores/confidentialModeStore';
import { useRedactedModeStore } from '@/lib/stores/redactedModeStore';
import {
  appendAssistantTurn,
  appendUserTurn,
  getTranscript,
  historyEntriesFor,
  replaceLastUserTurnContent,
} from '@/lib/storage/confidentialTranscriptStore';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generate unique message ID
const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// SSE watchdog: close stream if no events for this many ms
const WATCHDOG_SILENCE_MS = 60_000;
const WATCHDOG_CHECK_MS = 10_000;

// Polling: check status every N ms, stop after max duration
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_DURATION_MS = 600_000; // 10 minutes

// SSE reconnection: retry before falling back to polling
const SSE_MAX_RECONNECTS = 3;
const SSE_RECONNECT_DELAY_MS = 1_000;

// Heartbeat-only stale detection: if we receive this many consecutive
// heartbeats with zero data events, check the conversation status via API.
// At 5s heartbeat intervals, 12 heartbeats ≈ 60 seconds.
const HEARTBEAT_ONLY_THRESHOLD = 12;

export function useChatStream(options: UseChatStreamOptions = {}) {
  const {
    onConnected,
    onIteration,
    onToolCalling,
    onToolComplete,
    onCompleted,
    onError,
    onHistoryLoaded,
    onNarration,
  } = options;

  const [state, setState] = useState<ChatState>({
    messages: [],
    isStreaming: false, isCancelling: false,
    isLoadingHistory: false,
    conversationId: null,
    conversationTitle: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const conversationIdRef = useRef<string | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const reconnectStreamRef = useRef<(() => void) | null>(null);
  const consecutiveHeartbeatsRef = useRef<number>(0);
  const staleCheckInFlightRef = useRef<boolean>(false);
  const dedupKeysRef = useRef<Set<number>>(new Set());
  // v2_stream token-streaming state:
  // - textByIterationRef: per-iteration accumulator so text_reset only clears the affected iteration
  // - streamingMessageIdRef: ID of the placeholder ChatMessage currently being mutated
  // - currentIterationRef: iteration the placeholder belongs to
  const textByIterationRef = useRef<Map<number, string>>(new Map());
  const streamingMessageIdRef = useRef<string | null>(null);
  const currentIterationRef = useRef<number | null>(null);
  // Sub-agent streaming: per-agent_slug text accumulator (separate from orchestrator)
  const agentTextRef = useRef<Map<string, string>>(new Map());
  // Stream mode for the current/last execution — persisted so retry can forward it
  const streamModeRef = useRef<'v2_stream' | undefined>(undefined);
  // Jurisdiction choice for the current/last execution — persisted so retry can replay it
  const jurisdictionRef = useRef<JurisdictionChoice>({ mode: 'auto' });
  // Tool call queue: maps tool name → ordered list of message IDs for pending calls.
  // Ensures tool_complete updates the correct message when duplicate tool names exist.
  const toolCallQueueRef = useRef<Map<string, string[]>>(new Map());
  // Cancel guard ref — more reliable than state for preventing double-click
  const isCancellingRef = useRef<boolean>(false);
  const token = useAuthStore((state) => state.token);

  // ─── Internal helpers ──────────────────────────────────────

  // Add user message to state
  const addUserMessage = useCallback((
    content: string,
    attachments?: MessageAttachment[] | MessageAttachment,
  ): ChatMessage => {
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
      ...(list && list.length > 0 && {
        attachments: list,
        attachment: list[0],
      }),
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
      error: null,
    }));
    return message;
  }, []);

  // Remove a specific message by ID (used to roll back optimistic messages)
  const removeMessage = useCallback((messageId: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => m.id !== messageId),
    }));
  }, []);

  // Add assistant message (when completed)
  const addAssistantMessage = useCallback((content: string): string => {
    const id = generateId();
    const message: ChatMessage = {
      id,
      role: 'assistant',
      content,
      timestamp: new Date(),
      isStreaming: false,
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
    return id;
  }, []);

  // v2_stream: ensure a streaming assistant placeholder exists for the given iteration.
  // A new iteration creates a fresh placeholder message so iteration transitions
  // are visible in history (e.g., text from iteration 1 is kept above tool calls in iteration 2).
  const ensureStreamingPlaceholder = useCallback((iteration: number): string => {
    if (currentIterationRef.current !== iteration) {
      currentIterationRef.current = iteration;
      textByIterationRef.current.set(iteration, '');
      const id = generateId();
      streamingMessageIdRef.current = id;
      const placeholder: ChatMessage = {
        id,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setState((prev) => ({ ...prev, messages: [...prev.messages, placeholder] }));
      return id;
    }
    return streamingMessageIdRef.current!;
  }, []);

  // Add error message inline (for API errors from SSE error event)
  const addErrorMessage = useCallback(
    (errorMsg: string, errorCode: string, retryable: boolean, retryAfterMs: number | null): void => {
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
        isStreaming: false, isCancelling: false,
      }));
    },
    []
  );

  // Add tool call as a separate message in history
  const addToolMessage = useCallback(
    (toolCall: ToolCallingEvent): string => {
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
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, toolMessage],
      }));
      return id;
    },
    []
  );

  // Add handover message when sub-agent starts
  const addHandoverMessage = useCallback(
    (event: HandoverStartedEvent): string => {
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
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, handoverMsg],
      }));
      return id;
    },
    []
  );

  // Update handover message when sub-agent completes
  const updateHandoverMessage = useCallback(
    (event: HandoverCompleteEvent) => {
      // Clear the specialist's streaming buffer
      agentTextRef.current.delete(event.agent_slug);

      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) => {
          if (
            (msg as HandoverMessage).messageType === 'handover' &&
            (msg as HandoverMessage).agentSlug === event.agent_slug &&
            (msg as HandoverMessage).handoverStatus === 'active'
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
      }));
    },
    []
  );

  // Update streaming content on active handover for a given specialist
  const updateHandoverStreamingContent = useCallback(
    (agentSlug: string, content: string) => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) => {
          if (
            (msg as HandoverMessage).messageType === 'handover' &&
            (msg as HandoverMessage).agentSlug === agentSlug &&
            (msg as HandoverMessage).handoverStatus === 'active'
          ) {
            return { ...msg, streamingContent: content } as HandoverMessage;
          }
          return msg;
        }),
      }));
    },
    []
  );

  // Update tool message when complete — matched by message ID (not name)
  const updateToolMessage = useCallback(
    (msgId: string, event: ToolCompleteEvent) => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) => {
          if (msg.id === msgId) {
            return {
              ...msg,
              content: `${event.tool_call.name} completed`,
              toolResult: event.tool_result,
              toolStatus: 'complete',
              latencyMs: event.latency_ms,
            } as ToolMessage;
          }
          return msg;
        }),
      }));
    },
    []
  );

  // Merge missed messages from the status endpoint into state.
  // Replaces any SSE-originated messages after the last user message with API messages.
  const mergeMissedMessages = useCallback((apiMessages: ApiMessage[]) => {
    if (apiMessages.length === 0) return;
    const transformed = transformApiMessages(apiMessages);
    setState((prev) => {
      const lastUserIdx = [...prev.messages].reverse().findIndex((m) => m.role === 'user');
      if (lastUserIdx === -1) {
        return { ...prev, messages: [...prev.messages, ...transformed], isStreaming: false, isCancelling: false, error: null };
      }
      const cutIndex = prev.messages.length - lastUserIdx;
      return {
        ...prev,
        messages: [...prev.messages.slice(0, cutIndex), ...transformed],
        isStreaming: false, isCancelling: false,
        error: null,
      };
    });
  }, []);

  // ─── Polling ───────────────────────────────────────────────

  // Stop any active poll
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Poll status until no longer pending, then reload full conversation history.
  // This ensures all messages (tool calls, handovers, response) are present after recovery.
  const pollForCompletion = useCallback((conversationId: string) => {
    stopPolling();
    const startTime = Date.now();

    pollIntervalRef.current = setInterval(async () => {
      if (Date.now() - startTime > POLL_MAX_DURATION_MS) {
        stopPolling();
        setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: 'Response timed out. Please try again.' }));
        return;
      }

      try {
        const response = await chatApi.getStatus(conversationId);
        if (response.data.status !== 'pending') {
          stopPolling();
          // Reload full conversation to get all messages including tool calls
          try {
            const conv = await chatApi.getConversation(conversationId);
            if (conv.success && conv.data.messages) {
              const transformed = transformApiMessages(conv.data.messages);
              setState((prev) => ({
                ...prev,
                messages: transformed,
                conversationTitle: conv.data.title || prev.conversationTitle,
                isStreaming: false, isCancelling: false,
                error: null,
              }));
              onHistoryLoaded?.(conv.data);
            } else {
              setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
            }
          } catch {
            setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
          }
        }
      } catch {
        // Transient failure — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, onHistoryLoaded]);

  // ─── Watchdog ──────────────────────────────────────────────

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const startWatchdog = useCallback(() => {
    stopWatchdog();
    lastEventTimeRef.current = Date.now();

    watchdogRef.current = setInterval(() => {
      if (Date.now() - lastEventTimeRef.current > WATCHDOG_SILENCE_MS) {
        stopWatchdog();

        // Close the dead stream
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Try SSE reconnection first, falls back to polling after max retries
        reconnectStreamRef.current?.();
      }
    }, WATCHDOG_CHECK_MS);
  }, [stopWatchdog]);

  // ─── Stale stream check ─────────────────────────────────────
  // Detects when SSE is alive (heartbeats flowing) but no data events arrive,
  // e.g. when another tab already consumed the completed/end events.

  const checkStaleStream = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId || staleCheckInFlightRef.current) return;

    staleCheckInFlightRef.current = true;
    try {
      const response = await chatApi.getStatus(convId);
      const status = response.data.status;

      if (status !== 'pending') {
        // The AI finished but this tab never got the terminal event.
        // Close the stale stream and load the final conversation.
        stopWatchdog();
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        executionIdRef.current = null;

        try {
          const conv = await chatApi.getConversation(convId);
          if (conv.success && conv.data.messages) {
            const transformed = transformApiMessages(conv.data.messages);
            setState((prev) => ({
              ...prev,
              messages: transformed,
              conversationTitle: conv.data.title || prev.conversationTitle,
              isStreaming: false, isCancelling: false,
              error: null,
            }));
            onHistoryLoaded?.(conv.data);
          } else {
            setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
          }
        } catch {
          setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false, error: null }));
        }
      }
      // If still pending, reset counter and let the stream continue
      consecutiveHeartbeatsRef.current = 0;
    } catch {
      // Status check failed — reset and try again later
      consecutiveHeartbeatsRef.current = 0;
    } finally {
      staleCheckInFlightRef.current = false;
    }
  }, [stopWatchdog, onHistoryLoaded]);

  // ─── Load conversation history ─────────────────────────────

  const loadConversationHistory = useCallback(async (conversationId: string) => {
    setState((prev) => ({
      ...prev,
      isLoadingHistory: true,
      error: null,
      conversationId,
    }));
    conversationIdRef.current = conversationId;

    try {
      const response = await chatApi.getConversation(conversationId);

      if (response.success && response.data.messages) {
        const apiMessages = response.data.messages;
        const transformedMessages = transformApiMessages(apiMessages);

        // Build dedup set from seq numbers — collision-free dedup for SSE reconnect
        const dedup = new Set<number>();
        for (const msg of apiMessages) {
          const seq = msg.metadata?.seq;
          if (seq !== undefined) dedup.add(seq);
        }
        dedupKeysRef.current = dedup;

        setState((prev) => ({
          ...prev,
          messages: transformedMessages,
          conversationTitle: response.data.title || null,
          isLoadingHistory: false,
        }));
        onHistoryLoaded?.(response.data);
      } else {
        setState((prev) => ({
          ...prev,
          error: response.message || 'Failed to load conversation',
          isLoadingHistory: false,
        }));
      }
    } catch (err) {
      // Detect 404 specifically so conversation-client can show "not available" state
      const status = (err as { response?: { status?: number } })?.response?.status;
      const errorMsg = status === 404
        ? 'not_found'
        : err instanceof Error ? err.message : 'Failed to load conversation';
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoadingHistory: false,
      }));
      onError?.(errorMsg);
    }
  }, [onError, onHistoryLoaded]);

  // Load a confidential conversation's history from IndexedDB. Confidential
  // conversations 404 from the server by design; this is the local-storage
  // sibling of loadConversationHistory(). Returns true if a transcript was
  // found, false if the user hit a cold-load (transcript wiped or new device).
  const loadConversationHistoryFromIDB = useCallback(async (
    conversationId: string,
  ): Promise<boolean> => {
    setState((prev) => ({
      ...prev,
      isLoadingHistory: true,
      error: null,
      conversationId,
    }));
    conversationIdRef.current = conversationId;

    try {
      const transcript = await getTranscript(conversationId);
      if (!transcript) {
        setState((prev) => ({
          ...prev,
          messages: [],
          isLoadingHistory: false,
          error: 'confidential_transcript_lost',
        }));
        return false;
      }

      const messages: ConversationMessage[] = transcript.messages.map((m, idx) => {
        const list: MessageAttachment[] | undefined = m.attachments && m.attachments.length > 0
          ? m.attachments.map((a) => ({
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
          ...(list && {
            attachments: list,
            attachment: list[0],
          }),
        };
      });

      setState((prev) => ({
        ...prev,
        messages,
        conversationTitle: transcript.title ?? prev.conversationTitle,
        isLoadingHistory: false,
      }));
      return true;
    } catch {
      setState((prev) => ({
        ...prev,
        isLoadingHistory: false,
        error: 'confidential_transcript_lost',
      }));
      return false;
    }
  }, []);

  // Fetch only the conversation title (for after streaming completes)
  const fetchConversationTitle = useCallback(async (convId: string) => {
    try {
      const response = await chatApi.getConversation(convId);
      if (response.success && response.data.title) {
        setState((prev) => ({
          ...prev,
          conversationTitle: response.data.title,
        }));
      }
    } catch {
      // Silently fail - title is not critical
    }
  }, []);

  // ─── SSE stream connection ─────────────────────────────────

  // Connect to existing SSE stream (for when navigating from home page or reconnecting)
  const connectToStream = useCallback(
    (
      executionId: string,
      initialMessage?: string,
      initialAttachments?: MessageAttachment[] | MessageAttachment,
    ) => {
      if (!token) {
        const error = 'Authentication required';
        setState((prev) => ({ ...prev, error }));
        onError?.(error);
        return;
      }

      // Prevent multiple simultaneous connections
      if (eventSourceRef.current) {
        console.warn('Already connected to a stream, ignoring duplicate connection');
        return;
      }

      // Add initial user message if provided
      if (initialMessage) {
        addUserMessage(initialMessage, initialAttachments);
      }

      // Set streaming state (no assistant placeholder - we'll add it when completed)
      setState((prev) => ({
        ...prev,
        isStreaming: true, isCancelling: false,
        error: null,
      }));

      // Store execution ID for reconnection
      executionIdRef.current = executionId;

      // Connect to SSE stream
      const encodedToken = encodeURIComponent(token);
      const streamUrl = `${API_BASE_URL}/api/chat/stream/${executionId}?token=${encodedToken}`;

      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      // Start watchdog timer
      startWatchdog();

      // Snapshot dedup keys built from history — skip SSE events already rendered
      const dedup = dedupKeysRef.current;

      // Reset heartbeat-only counter on any real data event
      const resetHeartbeatCounter = () => {
        consecutiveHeartbeatsRef.current = 0;
      };

      // Handle connected event. On reconnect, the backend may send
      // accumulated_text with the in-progress response buffer so the
      // user doesn't see a gap after page refresh.
      eventSource.addEventListener('connected', (e) => {
        lastEventTimeRef.current = Date.now();
        reconnectCountRef.current = 0; // Reset on successful connection
        resetHeartbeatCounter();

        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data.accumulated_text) {
            const iteration = currentIterationRef.current ?? 0;
            const msgId = ensureStreamingPlaceholder(iteration);
            textByIterationRef.current.set(iteration, data.accumulated_text);
            setState((prev) => ({
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === msgId ? { ...m, content: data.accumulated_text } : m
              ),
            }));
          }
        } catch {
          // First connection or no data — ignore
        }

        onConnected?.();
      });

      // Handle iteration event
      eventSource.addEventListener('iteration', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: IterationEvent = JSON.parse(e.data);
        onIteration?.(event);
      });

      // Handle handover_started event - sub-agent delegation
      eventSource.addEventListener('handover_started', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: HandoverStartedEvent = JSON.parse(e.data);
        if (event.seq !== undefined && dedup.has(event.seq)) return;
        addHandoverMessage(event);
      });

      // Handle handover_complete event - sub-agent finished
      eventSource.addEventListener('handover_complete', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: HandoverCompleteEvent = JSON.parse(e.data);
        if (event.seq !== undefined && dedup.has(event.seq)) return;
        updateHandoverMessage(event);
      });

      // Handle tool_calling event - add as separate history entry.
      // Queue the message ID by tool name so tool_complete can match correctly
      // even when the same tool is called multiple times.
      eventSource.addEventListener('tool_calling', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: ToolCallingEvent = JSON.parse(e.data);
        if (event.seq !== undefined && dedup.has(event.seq)) return;
        // Skip internal handover tool calls — not user-visible
        if (event.tool_call.name === '_handover') return;
        const msgId = addToolMessage(event);
        const name = event.tool_call.name;
        const queue = toolCallQueueRef.current.get(name) || [];
        queue.push(msgId);
        toolCallQueueRef.current.set(name, queue);
        onToolCalling?.(event);
      });

      // Handle tool_complete event - consume the first pending message ID
      // for this tool name from the queue, ensuring correct FIFO matching.
      eventSource.addEventListener('tool_complete', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: ToolCompleteEvent = JSON.parse(e.data);
        if (event.seq !== undefined && dedup.has(event.seq)) return;
        // Skip internal handover tool calls — not user-visible
        if (event.tool_call.name === '_handover') return;
        const name = event.tool_call.name;
        const queue = toolCallQueueRef.current.get(name) || [];
        const msgId = queue.shift();
        if (msgId) {
          toolCallQueueRef.current.set(name, queue);
          updateToolMessage(msgId, event);
        }
        onToolComplete?.(event);
      });

      // v2_stream: token-level text delta. Append to per-iteration buffer and
      // mutate the streaming placeholder. NEVER dedup on seq — text deltas are
      // ephemeral and seq is a shared monotonic counter (per backend contract).
      // When agent_slug is present, the text is from a specialist sub-agent —
      // accumulate separately and push into the HandoverMessage's streamingContent.
      eventSource.addEventListener('text_delta', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: TextDeltaEvent = JSON.parse(e.data);

        if (event.agent_slug) {
          // Sub-agent text: accumulate separately, update HandoverMessage
          const slug = event.agent_slug;
          const current = agentTextRef.current.get(slug) ?? '';
          const updated = current + event.delta;
          agentTextRef.current.set(slug, updated);
          updateHandoverStreamingContent(slug, updated);
        } else {
          // Orchestrator text: existing behavior
          const msgId = ensureStreamingPlaceholder(event.iteration);
          const current = textByIterationRef.current.get(event.iteration) ?? '';
          const updated = current + event.delta;
          textByIterationRef.current.set(event.iteration, updated);
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === msgId ? { ...m, content: updated } : m
            ),
          }));
        }
      });

      // v2_stream: text stream finished for this iteration. Stop the
      // streaming cursor but keep content visible — `completed` will
      // replace it with authoritative text.
      eventSource.addEventListener('text_done', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: TextDoneEvent = JSON.parse(e.data);

        // Only stop cursor for orchestrator text, not sub-agent text
        if (!event.agent_slug) {
          const msgId = streamingMessageIdRef.current;
          if (msgId) {
            setState((prev) => ({
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === msgId ? { ...m, isStreaming: false } : m
              ),
            }));
          }

          // Confidential: persist the orchestrator's accumulated text to IDB
          // as soon as text_done fires — this is the device's one shot to
          // capture content before the server discards it. The subsequent
          // `completed` event will idempotently update the same row with
          // the authoritative final text. Confidential content — never log.
          const convId = conversationIdRef.current;
          if (convId && useConfidentialModeStore.getState().isConfidential(convId)) {
            const accumulated = textByIterationRef.current.get(event.iteration) ?? '';
            if (accumulated.trim()) {
              void appendAssistantTurn(convId, accumulated).catch(() => {});
            }
          }
        }
      });

      // v2_stream: model retried this iteration's text — clear the accumulator.
      // When agent_slug is present, clear only that specialist's buffer.
      eventSource.addEventListener('text_reset', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: TextResetEvent = JSON.parse(e.data);

        if (event.agent_slug) {
          // Capture sub-agent narration before clearing
          const currentText = agentTextRef.current.get(event.agent_slug) ?? '';
          if (currentText.trim()) {
            onNarration?.(currentText.trim(), event.agent_slug);
          }
          agentTextRef.current.set(event.agent_slug, '');
          updateHandoverStreamingContent(event.agent_slug, '');
          return;
        }

        const currentText = textByIterationRef.current.get(event.iteration) ?? '';
        const msgId = streamingMessageIdRef.current;
        // Option A heuristic: backend currently emits text_type:"response" for
        // inter-tool narration too, so text_type alone misclassifies narration
        // as a final answer. The real discriminator is reason:"tool_call" — a
        // genuine final response is terminated by text_done, never by text_reset
        // with reason:"tool_call". (Track for backend: persist metadata.type
        // "narration" on these messages so we can drop this heuristic.)
        const isFinalResponse =
          event.text_type === 'response' && event.reason !== 'tool_call';

        if (isFinalResponse && currentText.trim() && msgId && currentIterationRef.current === event.iteration) {
          // The orchestrator's real answer. The backend persists it as
          // metadata:null, so it survives refresh. Keep the already-rendered
          // text visible by finalizing the placeholder in place — detach refs
          // so the next iteration creates a fresh one.
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === msgId ? { ...m, content: currentText, isStreaming: false } : m
            ),
          }));
          textByIterationRef.current.set(event.iteration, '');
          streamingMessageIdRef.current = null;
          currentIterationRef.current = null;
          return;
        }

        // Narration text: show transiently via onNarration.
        if (currentText.trim() && !isFinalResponse) {
          onNarration?.(currentText.trim());
        }

        // Narration reset (or empty response): clear accumulator and remove
        // the placeholder so we don't flash an empty bubble before the next
        // iteration's content arrives.
        textByIterationRef.current.set(event.iteration, '');
        if (msgId && currentIterationRef.current === event.iteration) {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.filter((m) => m.id !== msgId),
          }));
          streamingMessageIdRef.current = null;
          currentIterationRef.current = null;
        }
      });

      // Handle heartbeat — track consecutive heartbeats without data events.
      // If threshold exceeded, check if the AI actually finished (another tab
      // may have consumed the completed/end events).
      eventSource.addEventListener('heartbeat', () => {
        lastEventTimeRef.current = Date.now();
        consecutiveHeartbeatsRef.current += 1;
        if (consecutiveHeartbeatsRef.current >= HEARTBEAT_ONLY_THRESHOLD) {
          checkStaleStream();
        }
      });

      // Handle thinking event — model is actively reasoning. Reset counters
      // so watchdog/heartbeat stale detection don't falsely trigger.
      eventSource.addEventListener('thinking', () => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
      });

      // Handle completed event. For v2_stream, replace the streaming placeholder
      // with authoritative content. For legacy, append a new assistant message.
      // `completed.content` is canonical; `completed.message` is a legacy alias.
      eventSource.addEventListener('completed', (e) => {
        lastEventTimeRef.current = Date.now();
        const event: CompletedEvent = JSON.parse(e.data);
        if (event.seq !== undefined && dedup.has(event.seq)) return;

        const convId = conversationIdRef.current;
        const isConfidential = !!convId && useConfidentialModeStore.getState().isConfidential(convId);

        // replayable === false: the server discarded the content (confidential
        // mode, late connect or DB replay). Fall back to the local transcript.
        // Never render a blank bubble.
        const finalText = event.content ?? event.message ?? '';
        if (event.replayable === false && isConfidential && convId) {
          void (async () => {
            try {
              const transcript = await getTranscript(convId);
              const lastAssistant = transcript?.messages
                .filter((m) => m.role === 'assistant')
                .slice(-1)[0];
              if (lastAssistant && lastAssistant.content) {
                const placeholderId = streamingMessageIdRef.current;
                if (placeholderId) {
                  setState((prev) => ({
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === placeholderId
                        ? { ...m, content: lastAssistant.content, isStreaming: false }
                        : m,
                    ),
                  }));
                  streamingMessageIdRef.current = null;
                  currentIterationRef.current = null;
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
          onCompleted?.(event);
          return;
        }

        // Confidential live path: persist the assistant's final content to IDB.
        // Idempotent with the text_done write — appendAssistantTurn updates the
        // last assistant row if one already exists for this turn.
        if (isConfidential && convId && finalText.trim()) {
          void appendAssistantTurn(convId, finalText).catch(() => {});
        }

        const placeholderId = streamingMessageIdRef.current;

        if (placeholderId) {
          // v2_stream path — replace placeholder with authoritative text.
          // Also clear handoverResultContent from any handover whose result
          // duplicates the final response to avoid showing the same text twice.
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) => {
              if (m.id === placeholderId) {
                return { ...m, content: finalText, isStreaming: false };
              }
              // Clear handoverResultContent when the final response duplicates
              // it — common with Writer agents whose output becomes the final text.
              const ho = m as HandoverMessage;
              if (
                ho.messageType === 'handover' &&
                ho.handoverResultContent &&
                ho.handoverResultContent.length > 50
              ) {
                const hoContent = ho.handoverResultContent;
                if (
                  finalText.includes(hoContent) ||
                  hoContent.includes(finalText)
                ) {
                  return { ...m, handoverResultContent: undefined } as HandoverMessage;
                }
              }
              return m;
            }),
          }));
          streamingMessageIdRef.current = null;
          currentIterationRef.current = null;
          textByIterationRef.current.clear();
          agentTextRef.current.clear();
        } else {
          // Legacy path — append a new assistant message
          addAssistantMessage(finalText);
        }

        onCompleted?.(event);
      });

      // Handle error event. Covers two distinct cases:
      //  1. `error_code === 'CANCELLED'` — user-initiated cancel confirmation.
      //     NOT a real error. Don't render an ErrorMessage; just finalize any
      //     v2_stream placeholder with its partial text and clear streaming state.
      //  2. Everything else — real backend error, render inline as before.
      //
      // NOTE: Browser connection errors also fire this listener (with no data).
      // We only handle events WITH data here; connection errors go to onerror.
      eventSource.addEventListener('error', (e) => {
        const data = (e as MessageEvent).data;
        if (!data) return; // Connection error — let onerror handle it

        lastEventTimeRef.current = Date.now();
        stopWatchdog();

        let parsed: {
          error_code?: string;
          error_message?: string;
          message?: string;
          retryable?: boolean;
          retry_after_ms?: number | null;
        } | null = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = null;
        }

        // Close the stream BEFORE branching so onerror's identity guard trips
        // regardless of which branch we take. Clear executionIdRef as
        // defense-in-depth against any orphan reconnect attempt.
        eventSource.close();
        eventSourceRef.current = null;
        executionIdRef.current = null;
        isCancellingRef.current = false;
        toolCallQueueRef.current.clear();

        // CANCELLED: user-initiated stop. Do NOT render as an error. Keep any
        // v2_stream placeholder's accumulated partial text visible (matches
        // ChatGPT/Claude cancel behavior).
        if (parsed?.error_code === 'CANCELLED') {
          const placeholderId = streamingMessageIdRef.current;
          if (placeholderId) {
            setState((prev) => ({
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === placeholderId ? { ...m, isStreaming: false } : m
              ),
              isStreaming: false,
              isCancelling: false,
            }));
            streamingMessageIdRef.current = null;
            currentIterationRef.current = null;
            textByIterationRef.current.clear();
            agentTextRef.current.clear();
          } else {
            setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
          }
          agentTextRef.current.clear();
          return;
        }

        // Real error — render inline as before.
        if (parsed) {
          const errorMsg = parsed.error_message || parsed.message || 'Something went wrong';
          const errorCode = parsed.error_code || 'UNKNOWN';
          const retryable = parsed.retryable ?? false;
          const retryAfterMs = parsed.retry_after_ms ?? null;
          addErrorMessage(errorMsg, errorCode, retryable, retryAfterMs);
          onError?.(errorMsg);
        } else {
          const errorMsg = 'Stream error';
          setState((prev) => ({ ...prev, error: errorMsg, isStreaming: false, isCancelling: false }));
          onError?.(errorMsg);
        }
      });

      // Handle cancelled event — user-initiated stop confirmed by backend.
      // Keep any v2_stream placeholder's accumulated partial text visible.
      eventSource.addEventListener('cancelled', () => {
        stopWatchdog();
        eventSource.close();
        eventSourceRef.current = null;
        executionIdRef.current = null;
        isCancellingRef.current = false;
        toolCallQueueRef.current.clear();

        const placeholderId = streamingMessageIdRef.current;
        if (placeholderId) {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === placeholderId ? { ...m, isStreaming: false } : m
            ),
            isStreaming: false,
            isCancelling: false,
          }));
          streamingMessageIdRef.current = null;
          currentIterationRef.current = null;
          textByIterationRef.current.clear();
          agentTextRef.current.clear();
        } else {
          setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
        }
      });

      // Handle end event
      eventSource.addEventListener('end', () => {
        stopWatchdog();
        eventSource.close();
        eventSourceRef.current = null;
        isCancellingRef.current = false;
        toolCallQueueRef.current.clear();

        // Finalize any v2_stream placeholder left open
        const placeholderId = streamingMessageIdRef.current;
        if (placeholderId) {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === placeholderId ? { ...m, isStreaming: false } : m
            ),
            isStreaming: false, isCancelling: false,
          }));
          streamingMessageIdRef.current = null;
          currentIterationRef.current = null;
          textByIterationRef.current.clear();
          agentTextRef.current.clear();
        } else {
          setState((prev) => ({
            ...prev,
            isStreaming: false, isCancelling: false,
          }));
        }
      });

      // Handle timeout event
      eventSource.addEventListener('timeout', () => {
        stopWatchdog();
        isCancellingRef.current = false;
        toolCallQueueRef.current.clear();
        const errorMsg = 'Stream timed out';

        // Finalize any v2_stream placeholder, tag as partial timeout
        const placeholderId = streamingMessageIdRef.current;
        if (placeholderId) {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === placeholderId
                ? {
                    ...m,
                    isStreaming: false,
                    ...(m.content ? { partial: { reason: 'timeout' as const } } : {}),
                  }
                : m
            ),
            error: errorMsg,
            isStreaming: false, isCancelling: false,
          }));
          streamingMessageIdRef.current = null;
          currentIterationRef.current = null;
          textByIterationRef.current.clear();
          agentTextRef.current.clear();
        } else {
          setState((prev) => ({
            ...prev,
            error: errorMsg,
            isStreaming: false, isCancelling: false,
          }));
        }

        onError?.(errorMsg);
        eventSource.close();
        eventSourceRef.current = null;
      });

      // Handle connection errors. Let the browser auto-reconnect when possible
      // — it sends Last-Event-ID so the backend can replay missed events.
      // Only intervene when EventSource is permanently CLOSED (readyState === 2).
      eventSource.onerror = () => {
        if (eventSourceRef.current !== eventSource) return;

        // readyState 0 = CONNECTING — browser is auto-reconnecting.
        // Let it proceed; the watchdog (60s silence) is the safety net.
        if (eventSource.readyState === 0) return;

        // readyState 2 = CLOSED — connection permanently dead.
        // Fall back to manual reconnect → polling.
        stopWatchdog();
        eventSource.close();
        eventSourceRef.current = null;
        reconnectStreamRef.current?.();
      };
    },
    [
      token,
      addUserMessage,
      addAssistantMessage,
      addErrorMessage,
      addHandoverMessage,
      updateHandoverMessage,
      updateHandoverStreamingContent,
      addToolMessage,
      updateToolMessage,
      ensureStreamingPlaceholder,
      startWatchdog,
      stopWatchdog,
      pollForCompletion,
      checkStaleStream,
      onConnected,
      onIteration,
      onToolCalling,
      onToolComplete,
      onCompleted,
      onError,
      onNarration,
    ]
  );

  // ─── SSE Reconnection ───────────────────────────────────────

  // Attempt to reconnect SSE before falling back to polling.
  // The backend picks up the live stream from Redis if still running,
  // or returns the result from DB if already finished.
  const reconnectStream = useCallback(() => {
    const execId = executionIdRef.current;
    const convId = conversationIdRef.current;

    // No execution ID or max retries exceeded → fall back to polling
    if (!execId || reconnectCountRef.current >= SSE_MAX_RECONNECTS) {
      reconnectCountRef.current = 0;
      if (convId) {
        pollForCompletion(convId);
      } else {
        setState((prev) => ({
          ...prev,
          isStreaming: false, isCancelling: false,
          error: 'Connection lost',
        }));
      }
      return;
    }

    reconnectCountRef.current += 1;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Brief delay before reconnecting to avoid hammering the server
    setTimeout(() => {
      // Guard: stream may have been intentionally closed during the delay
      if (!executionIdRef.current) return;
      connectToStream(executionIdRef.current);
    }, SSE_RECONNECT_DELAY_MS);
  }, [pollForCompletion, connectToStream]);

  // Keep ref in sync so onerror/watchdog callbacks can access latest reconnectStream
  reconnectStreamRef.current = reconnectStream;

  // ─── Set conversation ID ───────────────────────────────────

  const setConversationId = useCallback((id: string) => {
    conversationIdRef.current = id;
    setState((prev) => ({
      ...prev,
      conversationId: id,
    }));
  }, []);

  // ─── Disconnect / cleanup ─────────────────────────────────

  const disconnect = useCallback(() => {
    stopWatchdog();
    stopPolling();
    executionIdRef.current = null;
    reconnectCountRef.current = 0;
    consecutiveHeartbeatsRef.current = 0;
    dedupKeysRef.current = new Set();
    // v2_stream: clear text accumulators on full disconnect (but NOT on
    // SSE reconnect — the placeholder must persist so `completed` can replace it).
    textByIterationRef.current.clear();
    streamingMessageIdRef.current = null;
    currentIterationRef.current = null;
    toolCallQueueRef.current.clear();
    isCancellingRef.current = false;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
    }
  }, [stopWatchdog, stopPolling]);

  // Graceful cancel — POSTs to the cancel endpoint and waits for a terminal
  // SSE event (`cancelled`/`completed`/`error`/`timeout`) to finalize state.
  // Does NOT close the EventSource locally. See chatApi.cancelStream for why.
  const cancelStream = useCallback(() => {
    const execId = executionIdRef.current;
    if (!execId || !token) return;
    // Ref-based guard — immune to React batching / stale closure issues
    if (isCancellingRef.current) return;
    isCancellingRef.current = true;

    // Optimistic: show "Cancelling…" immediately
    setState((prev) => ({ ...prev, isCancelling: true }));

    // Fire-and-forget. The listener for `cancelled` (or a racing `completed`/
    // `error`/`timeout`) will close the stream and clear `isCancelling`.
    chatApi.cancelStream(execId, token);
  }, [token]);

  // Clear messages and reset state
  const clearChat = useCallback(() => {
    disconnect();
    conversationIdRef.current = null;
    jurisdictionRef.current = { mode: 'auto' };
    setState({
      messages: [],
      isStreaming: false, isCancelling: false,
      isLoadingHistory: false,
      conversationId: null,
      conversationTitle: null,
      error: null,
    });
  }, [disconnect]);

  // Set error message
  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
    }));
  }, []);

  // ─── Send (centralized send with 409/error handling) ───────

  const send = useCallback(async (
    message: string,
    options: SendMessageOptions = {},
  ) => {
    // Guard: prevent concurrent sends
    if (eventSourceRef.current) return;

    // Fresh send — no history to deduplicate against
    dedupKeysRef.current = new Set();

    const convId = options.conversationId || conversationIdRef.current;

    // Normalize attachments + file IDs into arrays. Callers may pass either
    // the legacy singular shape or the new plural shape — never both.
    const attachmentsList: MessageAttachment[] = options.attachments
      ?? (options.attachment ? [options.attachment] : []);
    const fileIdsList: number[] = options.fileIds
      ?? (options.fileId !== undefined ? [options.fileId] : []);

    // Confidential mode: source-of-truth is the Zustand confidentialIds set.
    // Subsequent turns (turn N>1) re-send the full prior transcript from IDB.
    const confidentialStore = useConfidentialModeStore.getState();
    const isConfidentialTurnN = !!convId && confidentialStore.isConfidential(convId);

    // Redacted mode: the flag is sticky after turn 1, so we never re-send it
    // on subsequent turns — but we still need to know locally so we can swap
    // the optimistic user message for the server's redacted form on response.
    const redactedStore = useRedactedModeStore.getState();
    const isRedactedTurnN = !!convId && redactedStore.isRedacted(convId);

    // Read prior history from IDB BEFORE appending the new user turn.
    let priorHistory: { role: 'user' | 'assistant' | 'tool'; content: string }[] = [];
    if (isConfidentialTurnN) {
      try {
        const transcript = await getTranscript(convId);
        priorHistory = historyEntriesFor(transcript);
      } catch {
        priorHistory = [];
      }

      // Persist the new user turn to IDB BEFORE the POST so a crash doesn't
      // lose it. Confidential content — never log or send to analytics.
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

    // Add optimistic user message
    const optimisticMsg = addUserMessage(message, attachmentsList);

    // Set streaming state
    setState((prev) => ({ ...prev, isStreaming: true, isCancelling: false, error: null }));

    try {
      // Persist stream mode so retry can forward it
      streamModeRef.current = options.streamMode;
      // Persist jurisdiction choice so retry replays the same selection
      const choice: JurisdictionChoice = options.jurisdiction ?? { mode: 'auto' };
      jurisdictionRef.current = choice;

      const baseBody = {
        message,
        stream: true as const,
        ...(convId && { conversation_id: convId }),
        // Canonical multi-file shape. Empty array would still validate but
        // we omit the field entirely when no files are attached to keep
        // the request body lean.
        ...(fileIdsList.length > 0 && { file_ids: fileIdsList }),
        ...(options.studyMode && { study_mode: true }),
        ...(options.workflowId && { workflow_id: options.workflowId }),
        ...(options.streamMode && { stream_mode: options.streamMode }),
        // Confidential turn N: re-send the prior transcript from IDB. The
        // `is_confidential` flag is set once at creation (turn 1) and is
        // immutable — never re-send it on subsequent turns.
        ...(isConfidentialTurnN && { messages: priorHistory }),
      };
      const response = await chatApi.start(applyJurisdiction(baseBody, choice));

      if (response.success) {
        // Redacted-mode response carries the canonical (redacted) form of the
        // user's turn so the local store stays in sync without a refetch.
        // Replace the optimistic message's text and patch the IDB row when
        // confidential is also on (raw text would otherwise reach the LLM
        // on the next turn via messages[]).
        const redactedText = response.data.user_message_content;
        if (isRedactedTurnN && redactedText && redactedText !== message) {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === optimisticMsg.id ? { ...m, content: redactedText } : m,
            ),
          }));
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
        // Backend returned success: false — reset state
        removeMessage(optimisticMsg.id);
        setState((prev) => ({
          ...prev,
          isStreaming: false, isCancelling: false,
          error: response.message || 'Failed to send message',
        }));
      }
    } catch (err) {
      // ── 409 PENDING_RESPONSE ──
      if (err instanceof AxiosError && err.response?.status === 409) {
        const responseData = err.response.data as { code?: string; data?: PendingResponseData } | undefined;
        if (responseData?.code === 'PENDING_RESPONSE') {
          // Remove the optimistic user message — the real one already exists on backend
          removeMessage(optimisticMsg.id);

          const pendingData = responseData.data;
          if (pendingData?.execution_id) {
            // Reconnect to the existing stream
            connectToStream(pendingData.execution_id);
          } else if (convId) {
            // No execution yet — poll status until it completes
            pollForCompletion(convId);
          } else {
            setState((prev) => ({
              ...prev,
              isStreaming: false, isCancelling: false,
              error: 'A response is still being generated.',
            }));
          }
          return;
        }
      }

      // ── 503 redaction service unavailable ──
      // Per spec, fail-closed: never fall back to sending raw text. Drop the
      // optimistic message and surface a retry-aware error so the user can
      // try again. Honor Retry-After if present.
      if (
        isRedactedTurnN &&
        err instanceof AxiosError &&
        err.response?.status === 503
      ) {
        removeMessage(optimisticMsg.id);
        const retryAfter = err.response.headers?.['retry-after'];
        const retryMsg = retryAfter
          ? `Redaction service is temporarily unavailable. Try again in ${retryAfter}s.`
          : 'Redaction service is temporarily unavailable. Please try again shortly.';
        setState((prev) => ({
          ...prev,
          isStreaming: false, isCancelling: false,
          error: retryMsg,
        }));
        return;
      }

      // ── 429 content duplicate ──
      if (err instanceof AxiosError && err.response?.status === 429) {
        removeMessage(optimisticMsg.id);
        setState((prev) => ({
          ...prev,
          isStreaming: false, isCancelling: false,
          error: 'This message was already sent. Please wait a moment.',
        }));
        return;
      }

      // ── Server-side block (no messages remaining, account flagged, etc.) ──
      // Surface as an in-stream ErrorMessage so the conversation page renders
      // the soft block banner instead of the generic destructive error box.
      const blocked = extractBlockedReason(err);
      if (blocked) {
        removeMessage(optimisticMsg.id);
        addErrorMessage(blocked.message, 'MESSAGES_EXHAUSTED', false, null);
        return;
      }

      // ── Generic error ──
      removeMessage(optimisticMsg.id);
      const errorMsg = err instanceof AxiosError
        ? (err.response?.data as { message?: string })?.message || 'Failed to send message'
        : 'Network error. Please try again.';
      setState((prev) => ({
        ...prev,
        isStreaming: false, isCancelling: false,
        error: errorMsg,
      }));
    }
  }, [addUserMessage, addErrorMessage, removeMessage, connectToStream, pollForCompletion]);

  // ─── Retry (fetch-before-retry with status check) ─────────

  const retryLastMessage = useCallback(async () => {
    // Guard: don't retry if already streaming
    if (state.isStreaming || eventSourceRef.current) return;

    const lastUserMsg = [...state.messages].reverse().find((m) => m.role === 'user');
    const convId = state.conversationId;
    if (!lastUserMsg || !convId) return;

    // Remove error messages, clear state.error, set streaming
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => !isErrorMessage(m)),
      error: null,
      isStreaming: true, isCancelling: false,
    }));

    try {
      // Check status first — the AI may have already responded
      const statusResponse = await chatApi.getStatus(convId);
      const status = statusResponse.data;

      if (status.status === 'completed') {
        // Response already exists — merge missed messages
        if (status.messages.length > 0) {
          mergeMissedMessages(status.messages);
        } else {
          setState((prev) => ({ ...prev, isStreaming: false, isCancelling: false }));
        }
        return;
      }

      if (status.status === 'pending' && status.execution_id) {
        // Still processing — reconnect to existing stream
        connectToStream(status.execution_id);
        return;
      }

      if (status.status === 'pending' && !status.execution_id) {
        // Pending but no execution yet — poll
        pollForCompletion(convId);
        return;
      }

      // Status is expired or idle — truly retry
      // Preserve all file attachments from the original message
      const originalMsg = lastUserMsg as ChatMessage;
      const retryAttachments = originalMsg.attachments
        ?? (originalMsg.attachment ? [originalMsg.attachment] : []);
      const retryFileIds = retryAttachments.map((a) => a.file_id);

      const retryBody = {
        message: lastUserMsg.content,
        stream: true as const,
        conversation_id: convId,
        ...(retryFileIds.length > 0 && { file_ids: retryFileIds }),
        ...(streamModeRef.current && { stream_mode: streamModeRef.current }),
      };
      const response = await chatApi.start(
        applyJurisdiction(retryBody, jurisdictionRef.current),
      );

      if (response.success) {
        connectToStream(response.data.execution_id);
      } else {
        setState((prev) => ({
          ...prev,
          error: response.message || 'Failed to retry',
          isStreaming: false, isCancelling: false,
        }));
      }
    } catch (err) {
      // Handle 409 from the chatApi.start() call
      if (err instanceof AxiosError && err.response?.status === 409) {
        const responseData = err.response.data as { code?: string; data?: PendingResponseData } | undefined;
        if (responseData?.code === 'PENDING_RESPONSE' && responseData.data?.execution_id) {
          connectToStream(responseData.data.execution_id);
          return;
        }
      }

      // Server-side block — surface as in-stream error so the soft banner renders.
      const blocked = extractBlockedReason(err);
      if (blocked) {
        addErrorMessage(blocked.message, 'MESSAGES_EXHAUSTED', false, null);
        return;
      }

      setState((prev) => ({
        ...prev,
        error: 'Failed to retry. Please try again.',
        isStreaming: false, isCancelling: false,
      }));
    }
  }, [state.messages, state.conversationId, state.isStreaming, addErrorMessage, connectToStream, mergeMissedMessages, pollForCompletion]);

  // ─── Recovery (for page reload / direct navigation) ────────

  const recoverPendingState = useCallback(async (conversationId: string): Promise<'reconnected' | 'completed' | 'failed' | 'expired' | 'idle' | 'load_history'> => {
    try {
      const response = await chatApi.getStatus(conversationId);
      const status = response.data;

      if (status.status === 'pending') {
        setState((prev) => ({ ...prev, isStreaming: true, isCancelling: false, error: null }));
        if (status.execution_id) {
          // Reconnect to live SSE stream for real-time tool call updates
          connectToStream(status.execution_id);
        } else {
          // No execution yet — poll until it completes
          pollForCompletion(conversationId);
        }
        return 'reconnected';
      }

      // For completed/failed/expired/idle, let the caller load history normally
      return status.status === 'idle' ? 'idle' : status.status as 'completed' | 'failed' | 'expired';
    } catch {
      // Status endpoint failed — fall back to loading history
      return 'load_history';
    }
  }, [pollForCompletion, connectToStream]);

  // ─── Public API ────────────────────────────────────────────

  return {
    // State
    messages: state.messages,
    isStreaming: state.isStreaming,
    isCancelling: state.isCancelling,
    isLoadingHistory: state.isLoadingHistory,
    conversationId: state.conversationId,
    conversationTitle: state.conversationTitle,
    error: state.error,
    // Actions
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
  };
}
