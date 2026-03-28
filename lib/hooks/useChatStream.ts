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
    isStreaming: false,
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
        isStreaming: false,
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
              handoverResultContent: event.response_preview || undefined,
            } as HandoverMessage;
          }
          return msg;
        }),
      }));
    },
    []
  );

  // Update tool message when complete
  const updateToolMessage = useCallback(
    (toolName: string, event: ToolCompleteEvent) => {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) => {
          if (
            msg.role === 'tool' &&
            (msg as ToolMessage).toolName === toolName &&
            (msg as ToolMessage).toolStatus === 'calling'
          ) {
            return {
              ...msg,
              content: `${toolName} completed`,
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
        return { ...prev, messages: [...prev.messages, ...transformed], isStreaming: false, error: null };
      }
      const cutIndex = prev.messages.length - lastUserIdx;
      return {
        ...prev,
        messages: [...prev.messages.slice(0, cutIndex), ...transformed],
        isStreaming: false,
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
        setState((prev) => ({ ...prev, isStreaming: false, error: 'Response timed out. Please try again.' }));
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
                isStreaming: false,
                error: null,
              }));
              onHistoryLoaded?.(conv.data);
            } else {
              setState((prev) => ({ ...prev, isStreaming: false, error: null }));
            }
          } catch {
            setState((prev) => ({ ...prev, isStreaming: false, error: null }));
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

        // Fall back to polling
        const convId = conversationIdRef.current;
        if (convId) {
          pollForCompletion(convId);
        } else {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: 'Connection lost',
          }));
        }
      }
    }, WATCHDOG_CHECK_MS);
  }, [stopWatchdog, pollForCompletion]);

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
        const transformedMessages = transformApiMessages(response.data.messages);
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
        isStreaming: true,
        error: null,
      }));

      // Connect to SSE stream
      const encodedToken = encodeURIComponent(token);
      const streamUrl = `${API_BASE_URL}/api/chat/stream/${executionId}?token=${encodedToken}`;

      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      // Start watchdog timer
      startWatchdog();

      // Handle connected event
      eventSource.addEventListener('connected', () => {
        lastEventTimeRef.current = Date.now();
        onConnected?.();
      });

      // Handle iteration event
      eventSource.addEventListener('iteration', (e) => {
        lastEventTimeRef.current = Date.now();
        const event: IterationEvent = JSON.parse(e.data);
        onIteration?.(event);
      });

      // Handle handover_started event - sub-agent delegation
      eventSource.addEventListener('handover_started', (e) => {
        lastEventTimeRef.current = Date.now();
        const event: HandoverStartedEvent = JSON.parse(e.data);
        addHandoverMessage(event);
      });

      // Handle handover_complete event - sub-agent finished
      eventSource.addEventListener('handover_complete', (e) => {
        lastEventTimeRef.current = Date.now();
        const event: HandoverCompleteEvent = JSON.parse(e.data);
        updateHandoverMessage(event);
      });

      // Handle tool_calling event - add as separate history entry
      eventSource.addEventListener('tool_calling', (e) => {
        lastEventTimeRef.current = Date.now();
        const event: ToolCallingEvent = JSON.parse(e.data);
        addToolMessage(event);
        onToolCalling?.(event);
      });

      // Handle tool_complete event - update the tool message
      eventSource.addEventListener('tool_complete', (e) => {
        lastEventTimeRef.current = Date.now();
        const event: ToolCompleteEvent = JSON.parse(e.data);
        updateToolMessage(event.tool_call.name, event);
        onToolComplete?.(event);
      });

      // Handle heartbeat (keep-alive)
      eventSource.addEventListener('heartbeat', () => {
        lastEventTimeRef.current = Date.now();
      });

      // Handle completed event - NOW add the assistant message
      eventSource.addEventListener('completed', (e) => {
        lastEventTimeRef.current = Date.now();
        const event: CompletedEvent = JSON.parse(e.data);
        addAssistantMessage(event.message);
        onCompleted?.(event);
      });

      // Handle error event - add inline as ErrorMessage so it appears in message flow
      // NOTE: Browser connection errors also fire this listener (with no data).
      // We only handle events WITH data here; connection errors are handled by onerror below.
      eventSource.addEventListener('error', (e) => {
        const data = (e as MessageEvent).data;
        if (!data) return; // Connection error — let onerror handle it

        lastEventTimeRef.current = Date.now();
        stopWatchdog();
        try {
          const event = JSON.parse(data);
          // Backend sends error_message (new) or message (legacy)
          const errorMsg = event.error_message || event.message || 'Something went wrong';
          const errorCode = event.error_code || 'UNKNOWN';
          const retryable = event.retryable ?? false;
          const retryAfterMs = event.retry_after_ms ?? null;
          addErrorMessage(errorMsg, errorCode, retryable, retryAfterMs);
          onError?.(errorMsg);
        } catch {
          // Unparseable data — show generic error
          const errorMsg = 'Stream error';
          setState((prev) => ({ ...prev, error: errorMsg, isStreaming: false }));
          onError?.(errorMsg);
        }
        eventSource.close();
        eventSourceRef.current = null;
      });

      // Handle end event
      eventSource.addEventListener('end', () => {
        stopWatchdog();
        eventSource.close();
        eventSourceRef.current = null;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
        }));
      });

      // Handle timeout event
      eventSource.addEventListener('timeout', () => {
        stopWatchdog();
        const errorMsg = 'Stream timed out';
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isStreaming: false,
        }));
        onError?.(errorMsg);
        eventSource.close();
        eventSourceRef.current = null;
      });

      // Handle connection errors — auto-recover via polling
      eventSource.onerror = () => {
        stopWatchdog();
        eventSource.close();
        eventSourceRef.current = null;

        // Try to auto-recover: poll status endpoint until network is back
        // and the response is ready. isStreaming stays true so the UI shows a loading indicator.
        const convId = conversationIdRef.current;
        if (convId) {
          pollForCompletion(convId);
        } else {
          // No conversation context — can't recover, show error
          const errorMsg = 'Connection error';
          setState((prev) => ({
            ...prev,
            error: errorMsg,
            isStreaming: false,
          }));
          onError?.(errorMsg);
        }
      };
    },
    [
      token,
      addUserMessage,
      addAssistantMessage,
      addErrorMessage,
      addHandoverMessage,
      updateHandoverMessage,
      addToolMessage,
      updateToolMessage,
      startWatchdog,
      stopWatchdog,
      pollForCompletion,
      onConnected,
      onIteration,
      onToolCalling,
      onToolComplete,
      onCompleted,
      onError,
    ]
  );

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
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, isStreaming: false }));
    }
  }, [stopWatchdog, stopPolling]);

  // Clear messages and reset state
  const clearChat = useCallback(() => {
    disconnect();
    conversationIdRef.current = null;
    setState({
      messages: [],
      isStreaming: false,
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

    const convId = options.conversationId || conversationIdRef.current;

    // Add optimistic user message
    const optimisticMsg = addUserMessage(message, options.attachment);

    // Set streaming state
    setState((prev) => ({ ...prev, isStreaming: true, error: null }));

    try {
      const response = await chatApi.start({
        message,
        stream: true,
        ...(convId && { conversation_id: convId }),
        ...(options.fileId && { file_id: options.fileId }),
        ...(options.studyMode && { study_mode: true }),
        ...(options.workflowId && { workflow_id: options.workflowId }),
      });

      if (response.success) {
        connectToStream(response.data.execution_id);
      } else {
        // Backend returned success: false — reset state
        removeMessage(optimisticMsg.id);
        setState((prev) => ({
          ...prev,
          isStreaming: false,
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
              isStreaming: false,
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
          isStreaming: false,
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
        isStreaming: false,
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
      isStreaming: true,
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
          setState((prev) => ({ ...prev, isStreaming: false }));
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
      });

      if (response.success) {
        connectToStream(response.data.execution_id);
      } else {
        setState((prev) => ({
          ...prev,
          error: response.message || 'Failed to retry',
          isStreaming: false,
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
        isStreaming: false,
      }));
    }
  }, [state.messages, state.conversationId, state.isStreaming, connectToStream, mergeMissedMessages, pollForCompletion]);

  // ─── Recovery (for page reload / direct navigation) ────────

  const recoverPendingState = useCallback(async (conversationId: string): Promise<'reconnected' | 'completed' | 'failed' | 'expired' | 'idle' | 'load_history'> => {
    try {
      const response = await chatApi.getStatus(conversationId);
      const status = response.data;

      if (status.status === 'pending') {
        // Always poll (not SSE reconnect) so that when execution completes,
        // we reload full conversation history with all tool calls included.
        setState((prev) => ({ ...prev, isStreaming: true, error: null }));
        pollForCompletion(conversationId);
        return 'reconnected';
      }

      // For completed/failed/expired/idle, let the caller load history normally
      return status.status === 'idle' ? 'idle' : status.status as 'completed' | 'failed' | 'expired';
    } catch {
      // Status endpoint failed — fall back to loading history
      return 'load_history';
    }
  }, [pollForCompletion]);

  // ─── Public API ────────────────────────────────────────────

  return {
    // State
    messages: state.messages,
    isStreaming: state.isStreaming,
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
    clearChat,
    setError,
    retryLastMessage,
    recoverPendingState,
  };
}
