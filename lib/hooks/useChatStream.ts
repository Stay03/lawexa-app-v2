'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  ChatMessage,
  ChatState,
  UseChatStreamOptions,
  CompletedEvent,
  ToolCallingEvent,
  ToolCompleteEvent,
  IterationEvent,
  ToolMessage,
  ApiMessage,
  ConversationMessage,
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
  const addUserMessage = useCallback((content: string): ChatMessage => {
    const message: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
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

    // Build a map of tool results by iteration for matching
    const toolResultsByIteration = new Map<number, ApiMessage>();
    apiMessages.forEach(msg => {
      if (msg.role === 'tool' && msg.metadata?.type === 'tool_result' && msg.metadata.iteration !== undefined) {
        toolResultsByIteration.set(msg.metadata.iteration, msg);
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
        } as ChatMessage);
      }
      // Assistant tool call - transform to ToolMessage with result
      else if (apiMsg.role === 'assistant' && apiMsg.metadata?.type === 'tool_call') {
        const toolResult = apiMsg.metadata.iteration !== undefined
          ? toolResultsByIteration.get(apiMsg.metadata.iteration)
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
      const errorMsg = err instanceof Error ? err.message : 'Failed to load conversation';
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
    (executionId: string, initialMessage?: string) => {
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
        addUserMessage(initialMessage);
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

      // Handle error event
      eventSource.addEventListener('error', (e) => {
        try {
          const event = JSON.parse((e as MessageEvent).data);
          const errorMsg = event.message || 'Stream error';
          setState((prev) => ({
            ...prev,
            error: errorMsg,
            isStreaming: false,
          }));
          onError?.(errorMsg);
        } catch {
          const errorMsg = 'Stream connection failed';
          setState((prev) => ({
            ...prev,
            error: errorMsg,
            isStreaming: false,
          }));
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
  };
}
