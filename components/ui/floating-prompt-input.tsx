'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AxiosError } from 'axios';
import { ArrowUp, Loader2, Check, X, ExternalLink, ChevronDown, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { chatApi } from '@/lib/api/chat';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  Message,
  MessageContent,
} from '@/components/prompt-kit/message';
import type {
  ChatMessage,
  ToolMessage,
  ConversationMessage,
  ToolCallingEvent,
  ToolCompleteEvent,
  CompletedEvent,
  PendingResponseData,
} from '@/types/chat';

interface FloatingPromptInputProps {
  className?: string;
  contextSlug?: string;
  contextType?: 'case' | 'note' | 'statute';
  contextTitle?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generate unique message ID
const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Format tool name and parameters into user-friendly text
function formatToolMessage(
  toolName: string,
  parameters: Record<string, unknown>,
  isComplete: boolean
): { action: string; detail?: string } {
  const query = parameters.query as string | undefined;

  switch (toolName) {
    case 'search_cases':
      return {
        action: isComplete ? 'Searched cases' : 'Searching cases',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'search_notes':
      return {
        action: isComplete ? 'Searched notes' : 'Searching notes',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'get_case':
    case 'get_case_details':
      return {
        action: isComplete ? 'Retrieved case' : 'Retrieving case',
      };
    case 'get_note':
    case 'get_note_details':
      return {
        action: isComplete ? 'Retrieved note' : 'Retrieving note',
      };
    default:
      return {
        action: isComplete
          ? `Completed ${toolName}`
          : `Running ${toolName}`,
      };
  }
}

// Format latency
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Tool message display component
function ToolMessageDisplay({ message }: { message: ToolMessage }) {
  const isComplete = message.toolStatus === 'complete';
  const isSuccess = isComplete && message.toolResult?.success;
  const isError = isComplete && !message.toolResult?.success;

  const { action, detail } = formatToolMessage(
    message.toolName,
    message.toolParameters,
    isComplete
  );

  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isSuccess && 'bg-green-500/10 text-green-600',
          isError && 'bg-destructive/10 text-destructive',
          !isComplete && 'bg-muted text-muted-foreground'
        )}
      >
        {!isComplete && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSuccess && <Check className="h-4 w-4" />}
        {isError && <X className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">
          {action}
          {detail && <span className="font-normal"> {detail}</span>}
        </span>
        {isComplete && message.latencyMs && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatLatency(message.latencyMs)}
          </p>
        )}
        {isError && (
          <p className="text-destructive mt-1 text-sm">
            Error: {message.toolResult?.error || 'Unknown error'}
          </p>
        )}
      </div>
    </div>
  );
}

export function FloatingPromptInput({ className, contextSlug, contextType, contextTitle }: FloatingPromptInputProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const token = useAuthStore((state) => state.token);
  const eventSourceRef = useRef<EventSource | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const hasReconnectedRef = useRef<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Calculate left offset based on sidebar state
  const sidebarWidth = isMobile ? '0px' : state === 'expanded' ? '16rem' : '3rem';

  const promptSuggestions = [
    'Explain this',
    'Quiz me 5 questions',
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Add user message
  const addUserMessage = useCallback((content: string): ChatMessage => {
    const message: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
    return message;
  }, []);

  // Add assistant message
  const addAssistantMessage = useCallback((content: string): string => {
    const id = generateId();
    const message: ChatMessage = {
      id,
      role: 'assistant',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
    return id;
  }, []);

  // Add tool message
  const addToolMessage = useCallback((toolCall: ToolCallingEvent): string => {
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
    setMessages((prev) => [...prev, toolMessage]);
    return id;
  }, []);

  // Update tool message when complete
  const updateToolMessage = useCallback(
    (toolName: string, event: ToolCompleteEvent) => {
      setMessages((prev) =>
        prev.map((msg) => {
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
        })
      );
    },
    []
  );

  // Connect to SSE stream
  const connectToStream = useCallback(
    (executionId: string) => {
      if (!token) {
        console.error('Authentication required');
        return;
      }

      if (eventSourceRef.current) {
        console.warn('Already connected to a stream');
        return;
      }

      // Store execution ID for reconnection
      executionIdRef.current = executionId;
      setIsStreaming(true);

      const encodedToken = encodeURIComponent(token);
      const streamUrl = `${API_BASE_URL}/api/chat/stream/${executionId}?token=${encodedToken}`;

      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', () => {
        hasReconnectedRef.current = false; // Reset on successful connection
      });

      eventSource.addEventListener('tool_calling', (e) => {
        const event: ToolCallingEvent = JSON.parse(e.data);
        addToolMessage(event);
      });

      eventSource.addEventListener('tool_complete', (e) => {
        const event: ToolCompleteEvent = JSON.parse(e.data);
        updateToolMessage(event.tool_call.name, event);
      });

      eventSource.addEventListener('completed', (e) => {
        const event: CompletedEvent = JSON.parse(e.data);
        addAssistantMessage(event.message);
      });

      eventSource.addEventListener('end', () => {
        eventSource.close();
        eventSourceRef.current = null;
        executionIdRef.current = null;
        setIsStreaming(false);
      });

      eventSource.addEventListener('error', () => {
        console.error('Stream error');
        eventSource.close();
        eventSourceRef.current = null;
        executionIdRef.current = null;
        setIsStreaming(false);
      });

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;

        // Try one SSE reconnect before giving up
        const execId = executionIdRef.current;
        if (execId && !hasReconnectedRef.current) {
          hasReconnectedRef.current = true;
          setTimeout(() => {
            if (!executionIdRef.current) return;
            connectToStream(executionIdRef.current);
          }, 1_000);
        } else {
          executionIdRef.current = null;
          setIsStreaming(false);
        }
      };
    },
    [token, addToolMessage, updateToolMessage, addAssistantMessage]
  );

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isSubmitting || isStreaming) return;

    const message = input.trim();
    setInput(''); // Clear input immediately
    setIsSubmitting(true);

    // Prepend context slug for the first message only
    let messageToSend = message;
    if (!conversationId && contextSlug && contextType) {
      const slugTagMap = { case: 'case_slug', note: 'note_slug', statute: 'statute_slug' } as const;
      const slugTag = slugTagMap[contextType];
      messageToSend = `<${slugTag}>${contextSlug}</${slugTag}>\n\n${message}`;
    }

    // Add user message to chat immediately (display original message without context)
    const optimisticMsg = addUserMessage(message);

    try {
      const response = await chatApi.start({
        message: messageToSend,
        stream: true,
        conversation_id: conversationId ?? undefined,
      });

      if (response.success) {
        const newConversationId = response.data.conversation_id;
        const executionId = response.data.execution_id;

        // Save conversation ID for subsequent messages
        if (!conversationId) {
          setConversationId(newConversationId);
        }

        // Connect to SSE stream to receive messages inline
        connectToStream(executionId);
      } else {
        // Backend returned success: false
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setError(response.message || 'Failed to send message');
        setIsStreaming(false);
      }
    } catch (err) {
      // Handle 409 PENDING_RESPONSE — reconnect instead of showing error
      if (err instanceof AxiosError && err.response?.status === 409) {
        const responseData = err.response.data as { code?: string; data?: PendingResponseData } | undefined;
        if (responseData?.code === 'PENDING_RESPONSE') {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
          if (responseData.data?.execution_id) {
            connectToStream(responseData.data.execution_id);
          } else {
            setIsStreaming(false);
            setError('A response is still being generated.');
          }
          setIsSubmitting(false);
          return;
        }
      }

      // Handle 429 content duplicate
      if (err instanceof AxiosError && err.response?.status === 429) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setError('This message was already sent. Please wait a moment.');
        setIsSubmitting(false);
        return;
      }

      const apiError = extractApiError(err);
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Collapsed state — just show a floating button
  if (!isOpen) {
    return (
      <div
        className={cn(
          'fixed bottom-4 z-50 right-0 px-4 transition-[left] duration-200 ease-linear',
          className
        )}
        style={{ left: sidebarWidth }}
      >
        <div className="mx-auto flex max-w-xs justify-end sm:max-w-md">
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 z-50 right-0 px-4 transition-[left] duration-200 ease-linear',
        className
      )}
      style={{ left: sidebarWidth }}
    >
      <div className="mx-auto max-w-sm sm:max-w-lg">
        {/* Chat Panel */}
        <div className="bg-background mb-2 overflow-hidden rounded-2xl border border-border shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="min-w-0 truncate text-xs">
              {contextTitle ? (
                <>
                  <span className="text-yellow-600 dark:text-yellow-500">CHAT ABOUT:</span>{' '}
                  <span className="font-medium text-foreground">{contextTitle}</span>
                </>
              ) : (
                <span className="font-medium text-foreground">Chat</span>
              )}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {conversationId && (
                <button
                  onClick={() => router.push(`/c/${conversationId}`)}
                  className="rounded-md p-1.5 hover:bg-muted transition-colors"
                  aria-label="Open conversation in full page"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 hover:bg-muted transition-colors"
                aria-label="Close chat"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <div
            ref={chatContainerRef}
            className="h-[350px] overflow-y-auto p-4"
          >
            {messages.length === 0 ? (
              /* Prompt Suggestions - shown when no messages */
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="text-xs text-muted-foreground">Suggested prompts</p>
                <div className="flex w-full flex-col gap-2">
                  {promptSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="rounded-xl border border-border px-4 py-3 text-left text-sm transition-all duration-200 hover:border-primary/50 hover:bg-primary/5"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message History */
              <div className="flex flex-col gap-4">
                {messages.map((message) => {
                  if (message.role === 'tool') {
                    return (
                      <ToolMessageDisplay
                        key={message.id}
                        message={message as ToolMessage}
                      />
                    );
                  }

                  return (
                    <Message key={message.id} role={message.role as 'user' | 'assistant'}>
                      <MessageContent markdown={message.role === 'assistant'}>
                        {message.content}
                      </MessageContent>
                    </Message>
                  );
                })}
                {isStreaming && (
                  <div className="text-sm text-muted-foreground italic">
                    Thinking...
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input — same style as conversation page */}
        <PromptInput
          value={input}
          onValueChange={(value) => {
            setInput(value);
            if (error) setError(null);
          }}
          onSubmit={handleSubmit}
          disabled={isSubmitting}
          maxHeight={150}
        >
          <PromptInputTextarea
            placeholder="Ask me anything"
            className="text-foreground min-h-[36px] py-2 px-3"
          />
          <div className="flex items-center justify-end px-2 pb-1">
            <PromptInputAction tooltip="Send message">
              <Button
                size="icon"
                className="bg-primary hover:bg-primary/90 h-7 w-7 shrink-0 rounded-full"
                onClick={handleSubmit}
                onMouseDown={(e) => e.preventDefault()}
                disabled={!input.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </PromptInputAction>
          </div>
        </PromptInput>
      </div>
    </div>
  );
}
