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
} from '@/types/chat';

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
    conversationId: null,
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
  const setConversationId = useCallback((id: number) => {
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
      conversationId: null,
      error: null,
    });
  }, [disconnect]);

  return {
    // State
    messages: state.messages,
    isStreaming: state.isStreaming,
    conversationId: state.conversationId,
    error: state.error,
    // Actions
    connectToStream,
    setConversationId,
    addUserMessage,
    disconnect,
    clearChat,
  };
}
