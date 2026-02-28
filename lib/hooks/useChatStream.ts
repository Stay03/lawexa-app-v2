'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  isErrorMessage,
  type ChatMessage,
  type ChatState,
  type UseChatStreamOptions,
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
} from '@/types/chat';
import { chatApi } from '@/lib/api/chat';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generate unique message ID
const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export function useChatStream(options: UseChatStreamOptions = {}) {
  const {
    onConnected,
    onIteration,
    onToolCalling,
    onToolComplete,
    onCompleted,
    onError,
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
  const token = useAuthStore((state) => state.token);

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
          // Only use content if it's not raw JSON (i.e., it's the agent's actual response)
          if (content && !content.startsWith('{')) {
            handoverResultContent = content;
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

  // Load conversation history from API
  const loadConversationHistory = useCallback(async (conversationId: string) => {
    setState((prev) => ({
      ...prev,
      isLoadingHistory: true,
      error: null,
      conversationId,
    }));

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
  }, [transformApiMessages, onError]);

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

  // Connect to existing SSE stream (for when navigating from home page)
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

      // Handle connected event
      eventSource.addEventListener('connected', () => {
        onConnected?.();
      });

      // Handle iteration event
      eventSource.addEventListener('iteration', (e) => {
        const event: IterationEvent = JSON.parse(e.data);
        onIteration?.(event);
      });

      // Handle handover_started event - sub-agent delegation
      eventSource.addEventListener('handover_started', (e) => {
        const event: HandoverStartedEvent = JSON.parse(e.data);
        addHandoverMessage(event);
      });

      // Handle handover_complete event - sub-agent finished
      eventSource.addEventListener('handover_complete', (e) => {
        const event: HandoverCompleteEvent = JSON.parse(e.data);
        updateHandoverMessage(event);
      });

      // Handle tool_calling event - add as separate history entry
      eventSource.addEventListener('tool_calling', (e) => {
        const event: ToolCallingEvent = JSON.parse(e.data);
        addToolMessage(event);
        onToolCalling?.(event);
      });

      // Handle tool_complete event - update the tool message
      eventSource.addEventListener('tool_complete', (e) => {
        const event: ToolCompleteEvent = JSON.parse(e.data);
        updateToolMessage(event.tool_call.name, event);
        onToolComplete?.(event);
      });

      // Handle heartbeat (keep-alive, no action needed)
      eventSource.addEventListener('heartbeat', () => {
        // No action needed
      });

      // Handle completed event - NOW add the assistant message
      eventSource.addEventListener('completed', (e) => {
        const event: CompletedEvent = JSON.parse(e.data);
        addAssistantMessage(event.message);
        onCompleted?.(event);
      });

      // Handle error event - add inline as ErrorMessage so it appears in message flow
      eventSource.addEventListener('error', (e) => {
        try {
          const event = JSON.parse((e as MessageEvent).data);
          // Backend sends error_message (new) or message (legacy)
          const errorMsg = event.error_message || event.message || 'Something went wrong';
          const errorCode = event.error_code || 'UNKNOWN';
          const retryable = event.retryable ?? false;
          const retryAfterMs = event.retry_after_ms ?? null;
          addErrorMessage(errorMsg, errorCode, retryable, retryAfterMs);
          onError?.(errorMsg);
        } catch {
          // Fallback: unparseable error event, use state.error
          const errorMsg = 'Stream error';
          setState((prev) => ({ ...prev, error: errorMsg, isStreaming: false }));
          onError?.(errorMsg);
        }
        eventSource.close();
      });

      // Handle end event
      eventSource.addEventListener('end', () => {
        eventSource.close();
        eventSourceRef.current = null;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
        }));
      });

      // Handle timeout event
      eventSource.addEventListener('timeout', () => {
        const errorMsg = 'Stream timed out';
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isStreaming: false,
        }));
        onError?.(errorMsg);
        eventSource.close();
      });

      // Handle connection errors
      eventSource.onerror = () => {
        const errorMsg = 'Connection error';
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isStreaming: false,
        }));
        onError?.(errorMsg);
        eventSource.close();
        eventSourceRef.current = null;
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
      onConnected,
      onIteration,
      onToolCalling,
      onToolComplete,
      onCompleted,
      onError,
    ]
  );

  // Set conversation ID
  const setConversationId = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      conversationId: id,
    }));
  }, []);

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, isStreaming: false }));
    }
  }, []);

  // Clear messages and reset state
  const clearChat = useCallback(() => {
    disconnect();
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

  // Retry the last user message after an error
  const retryLastMessage = useCallback(async () => {
    const lastUserMsg = [...state.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg || !state.conversationId) return;

    // Remove error messages, clear state.error, set streaming
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => !isErrorMessage(m)),
      error: null,
      isStreaming: true,
    }));

    try {
      const response = await chatApi.start({
        message: lastUserMsg.content,
        stream: true,
        conversation_id: state.conversationId,
      });

      if (response.success) {
        connectToStream(response.data.execution_id);
      }
    } catch {
      setState((prev) => ({
        ...prev,
        error: 'Failed to retry. Please try again.',
        isStreaming: false,
      }));
    }
  }, [state.messages, state.conversationId, connectToStream]);

  return {
    // State
    messages: state.messages,
    isStreaming: state.isStreaming,
    isLoadingHistory: state.isLoadingHistory,
    conversationId: state.conversationId,
    conversationTitle: state.conversationTitle,
    error: state.error,
    // Actions
    connectToStream,
    loadConversationHistory,
    fetchConversationTitle,
    setConversationId,
    addUserMessage,
    disconnect,
    clearChat,
    setError,
    retryLastMessage,
  };
}
