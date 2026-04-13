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
  // Tool call queue: maps tool name → ordered list of message IDs for pending calls.
  // Ensures tool_complete updates the correct message when duplicate tool names exist.
  const toolCallQueueRef = useRef<Map<string, string[]>>(new Map());
  // Cancel guard ref — more reliable than state for preventing double-click
  const isCancellingRef = useRef<boolean>(false);
  const token = useAuthStore((state) => state.token);

  // ─── Internal helpers ──────────────────────────────────────

  // Add user message to state
  const addUserMessage = useCallback((content: string, attachment?: MessageAttachment): ChatMessage => {
    const message: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      ...(attachment && { attachment }),
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

  // Transform API messages to local message format
  const transformApiMessages = useCallback((apiMessages: ApiMessage[]): ConversationMessage[] => {
    const messages: ConversationMessage[] = [];

    // Build lists of tool results by iteration for matching (lists handle iteration resets across executions)
    const toolResultsByIteration = new Map<number, ApiMessage[]>();
    apiMessages.forEach(msg => {
      if (msg.role === 'tool' && msg.metadata?.type === 'tool_result' && msg.metadata.iteration !== undefined) {
        const list = toolResultsByIteration.get(msg.metadata.iteration) || [];
        list.push(msg);
        toolResultsByIteration.set(msg.metadata.iteration, list);
      }
    });

    // Build lists of handover results by iteration for matching
    const handoverResultsByIteration = new Map<number, ApiMessage[]>();
    apiMessages.forEach(msg => {
      if (msg.role === 'assistant' && msg.metadata?.type === 'handover_result' && msg.metadata.iteration !== undefined) {
        const list = handoverResultsByIteration.get(msg.metadata.iteration) || [];
        list.push(msg);
        handoverResultsByIteration.set(msg.metadata.iteration, list);
      }
    });

    for (const apiMsg of apiMessages) {
      // User message
      if (apiMsg.role === 'user') {
        messages.push({
          id: `msg_${apiMsg.id}`,
          role: 'user',
          content: apiMsg.content,
          timestamp: new Date(apiMsg.created_at),
          ...(apiMsg.attachment && { attachment: apiMsg.attachment }),
        } as ChatMessage);
      }
      // Handover message - orchestrator delegating to sub-agent
      else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'handover') {
        const iteration = apiMsg.metadata.iteration;
        const handoverResult = iteration !== undefined
          ? handoverResultsByIteration.get(iteration)?.shift()
          : undefined;

        // Extract handover result content if available
        let handoverResultContent: string | undefined;
        if (handoverResult) {
          const content = handoverResult.content;
          if (content) {
            // If content looks like JSON, try to extract the agent's text response
            if (content.startsWith('{')) {
              try {
                const parsed = JSON.parse(content);
                handoverResultContent = parsed.response || parsed.content || parsed.message || content;
              } catch {
                handoverResultContent = content;
              }
            } else {
              handoverResultContent = content;
            }
          }
        }

        messages.push({
          id: `msg_${apiMsg.id}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(apiMsg.created_at),
          messageType: 'handover',
          agentSlug: apiMsg.metadata.target_agent || 'agent',
          task: apiMsg.metadata.task || '',
          handoverStatus: 'complete',
          handoverType: handoverResult?.metadata?.handover_type || apiMsg.metadata.handover_type || 'consult',
          latencyMs: handoverResult?.metadata?.latency_ms,
          success: handoverResult?.metadata?.success ?? true,
          handoverResultContent,
        } as HandoverMessage);
      }
      // Skip handover result messages (already captured above)
      else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'handover_result') {
        continue;
      }
      // Skip narration messages — internal orchestrator commentary not shown to users
      else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'narration') {
        continue;
      }
      // Assistant tool call - transform to ToolMessage with result
      else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'tool_call') {
        const toolResult = apiMsg.metadata.iteration !== undefined
          ? toolResultsByIteration.get(apiMsg.metadata.iteration)?.shift()
          : undefined;

        // Parse tool result if available
        let parsedToolResult = undefined;
        if (toolResult) {
          try {
            const resultData = JSON.parse(toolResult.content);
            parsedToolResult = {
              success: toolResult.metadata?.success ?? resultData.success ?? true,
              data: resultData.data ?? resultData,
              error: null,
            };
          } catch {
            parsedToolResult = {
              success: toolResult.metadata?.success ?? true,
              data: toolResult.content,
              error: null,
            };
          }
        }

        messages.push({
          id: `msg_${apiMsg.id}`,
          role: 'tool',
          content: `${apiMsg.metadata.tool_name} completed`,
          timestamp: new Date(apiMsg.created_at),
          toolName: apiMsg.metadata.tool_name || 'unknown',
          toolParameters: apiMsg.metadata.tool_parameters || {},
          toolResult: parsedToolResult,
          toolStatus: 'complete',
          latencyMs: toolResult?.metadata?.latency_ms,
        } as ToolMessage);
      }
      // Skip tool role messages (already captured via tool_call)
      else if (apiMsg.role === 'tool') {
        continue;
      }
      // Partial assistant message — the stream was cancelled or errored
      // mid-response and the backend rescued whatever text had been generated.
      // Render as a normal ChatMessage (with markdown etc.) but tagged so the
      // UI can show a "Stopped" / "Interrupted" badge beneath the content.
      // IMPORTANT: this branch MUST come before the `type === 'error'` branch
      // below, so partial precedence wins if both flags ever co-occur.
      else if (apiMsg.role === 'assistant' && apiMsg.metadata?.partial === true) {
        messages.push({
          id: `msg_${apiMsg.id}`,
          role: 'assistant',
          content: apiMsg.content,
          timestamp: new Date(apiMsg.created_at),
          partial: {
            reason: apiMsg.metadata.reason ?? 'cancelled',
          },
        } as ChatMessage);
      }
      // Error message saved by backend
      else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'error') {
        messages.push({
          id: `msg_${apiMsg.id}`,
          role: 'assistant',
          content: apiMsg.content,
          timestamp: new Date(apiMsg.created_at),
          messageType: 'error',
          errorCode: apiMsg.metadata.error_code || 'UNKNOWN',
          retryable: apiMsg.metadata.retryable ?? false,
          retryAfterMs: apiMsg.metadata.retry_after_ms ?? null,
        } as ErrorMessage);
      }
      // Regular assistant message (final response)
      else if (apiMsg.role === 'assistant' && !apiMsg.metadata?.type) {
        messages.push({
          id: `msg_${apiMsg.id}`,
          role: 'assistant',
          content: apiMsg.content,
          timestamp: new Date(apiMsg.created_at),
        } as ChatMessage);
      }
    }

    return messages;
  }, []);

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
  }, [transformApiMessages]);

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
  }, [stopPolling, transformApiMessages, onHistoryLoaded]);

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
  }, [stopWatchdog, transformApiMessages, onHistoryLoaded]);

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
  }, [transformApiMessages, onError, onHistoryLoaded]);

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
    (executionId: string, initialMessage?: string, initialAttachment?: MessageAttachment) => {
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
        addUserMessage(initialMessage, initialAttachment);
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

      // Handle connected event
      eventSource.addEventListener('connected', () => {
        lastEventTimeRef.current = Date.now();
        reconnectCountRef.current = 0; // Reset on successful connection
        resetHeartbeatCounter();
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
        }
      });

      // v2_stream: model retried this iteration's text — clear the accumulator.
      // When agent_slug is present, clear only that specialist's buffer.
      eventSource.addEventListener('text_reset', (e) => {
        lastEventTimeRef.current = Date.now();
        resetHeartbeatCounter();
        const event: TextResetEvent = JSON.parse(e.data);

        if (event.agent_slug) {
          agentTextRef.current.set(event.agent_slug, '');
          updateHandoverStreamingContent(event.agent_slug, '');
          return;
        }

        // Orchestrator reset: existing behavior
        textByIterationRef.current.set(event.iteration, '');
        const msgId = streamingMessageIdRef.current;
        if (msgId && currentIterationRef.current === event.iteration) {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === msgId ? { ...m, content: '' } : m
            ),
          }));
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

        const finalText = event.content ?? event.message ?? '';
        const placeholderId = streamingMessageIdRef.current;

        if (placeholderId) {
          // v2_stream path — replace placeholder with authoritative text
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === placeholderId
                ? { ...m, content: finalText, isStreaming: false }
                : m
            ),
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

    // Add optimistic user message
    const optimisticMsg = addUserMessage(message, options.attachment);

    // Set streaming state
    setState((prev) => ({ ...prev, isStreaming: true, isCancelling: false, error: null }));

    try {
      // Persist stream mode so retry can forward it
      streamModeRef.current = options.streamMode;

      const response = await chatApi.start({
        message,
        stream: true,
        ...(convId && { conversation_id: convId }),
        ...(options.fileId && { file_id: options.fileId }),
        ...(options.studyMode && { study_mode: true }),
        ...(options.workflowId && { workflow_id: options.workflowId }),
        ...(options.streamMode && { stream_mode: options.streamMode }),
      });

      if (response.success) {
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
  }, [addUserMessage, removeMessage, connectToStream, pollForCompletion]);

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
      // Preserve file attachment from original message
      const fileId = (lastUserMsg as ChatMessage)?.attachment?.file_id;

      const response = await chatApi.start({
        message: lastUserMsg.content,
        stream: true,
        conversation_id: convId,
        ...(fileId && { file_id: fileId }),
        ...(streamModeRef.current && { stream_mode: streamModeRef.current }),
      });

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

      setState((prev) => ({
        ...prev,
        error: 'Failed to retry. Please try again.',
        isStreaming: false, isCancelling: false,
      }));
    }
  }, [state.messages, state.conversationId, state.isStreaming, connectToStream, mergeMissedMessages, pollForCompletion]);

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
