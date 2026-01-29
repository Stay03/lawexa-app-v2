'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowUp, Loader2, Check, X, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { chatApi } from '@/lib/api/chat';
import { cn } from '@/lib/utils';
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
} from '@/types/chat';

interface FloatingPromptInputProps {
  className?: string;
  contextSlug?: string;
  contextType?: 'case' | 'note';
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
  const [isFocused, setIsFocused] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const router = useRouter();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const token = useAuthStore((state) => state.token);
  const eventSourceRef = useRef<EventSource | null>(null);
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

      setIsStreaming(true);

      const encodedToken = encodeURIComponent(token);
      const streamUrl = `${API_BASE_URL}/api/chat/stream/${executionId}?token=${encodedToken}`;

      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', () => {
        console.log('Stream connected');
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
        setIsStreaming(false);
      });

      eventSource.addEventListener('error', () => {
        console.error('Stream error');
        eventSource.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
      });

      eventSource.onerror = () => {
        console.error('Connection error');
        eventSource.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
      };
    },
    [token, addToolMessage, updateToolMessage, addAssistantMessage]
  );

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    // Keep the input focused after clicking suggestion
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder="Ask a question..."]') as HTMLTextAreaElement;
      textarea?.focus();
    }, 0);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isSubmitting || isStreaming) return;

    const message = input.trim();
    setInput(''); // Clear input immediately
    setIsSubmitting(true);

    // Prepend context slug for the first message only
    let messageToSend = message;
    if (!conversationId && contextSlug && contextType) {
      const slugTag = contextType === 'case' ? 'case_slug' : 'note_slug';
      messageToSend = `<${slugTag}>${contextSlug}</${slugTag}>\n\n${message}`;
    }

    // Add user message to chat immediately (display original message without context)
    addUserMessage(message);

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
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 z-50 right-0 px-4 transition-[left] duration-200 ease-linear',
        className
      )}
      style={{ left: sidebarWidth }}
    >
      <div className={cn(
        "mx-auto transition-all duration-300 ease-out",
        isFocused ? "max-w-sm sm:max-w-lg" : "max-w-xs sm:max-w-md"
      )}>
        {/* Expandable Chat/Suggestions Area */}
        <div
          className={cn(
            "transition-all duration-300 ease-out overflow-hidden mb-2",
            isFocused ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
          )}
          onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking inside
        >
          <div className="bg-background rounded-t-3xl shadow-xs border border-border">
            {/* Header - Chat about... */}
            {contextTitle && (
              <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                <p className="text-xs truncate">
                  <span className="text-yellow-600 dark:text-yellow-500">CHAT ABOUT:</span> <span className="font-medium text-foreground">{contextTitle}</span>
                </p>
                {conversationId && (
                  <button
                    onClick={() => router.push(`/c/${conversationId}`)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
                    aria-label="Open conversation in full page"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            )}

            {/* Chat Content */}
            <div
              ref={chatContainerRef}
              className="p-4 h-[350px] overflow-y-auto"
            >
            {messages.length === 0 ? (
              /* Prompt Suggestions - shown when no messages */
              <div className="flex flex-col gap-2">
                {promptSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-left px-4 py-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              /* Message History - shown when conversation exists */
              <div className="flex flex-col gap-4">
                {messages.map((message) => {
                  // Handle tool messages separately
                  if (message.role === 'tool') {
                    return (
                      <ToolMessageDisplay
                        key={message.id}
                        message={message as ToolMessage}
                      />
                    );
                  }

                  // Handle user and assistant messages
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
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Prompt Input */}
        <div className={cn(
          "transition-all duration-300 ease-out",
          !isFocused && "hover:scale-105"
        )}>
          <PromptInput
            value={input}
            onValueChange={setInput}
            onSubmit={handleSubmit}
            disabled={isSubmitting}
            maxHeight={36}
          >
            <div className="flex items-center gap-2 px-1">
              <PromptInputTextarea
                placeholder="Ask a question..."
                className="text-foreground min-h-[36px] py-2"
                disableAutosize
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              <PromptInputAction tooltip="Send message">
                <Button
                  size="icon"
                  className="bg-primary hover:bg-primary/90 h-7 w-7 rounded-full shrink-0"
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
    </div>
  );
}
