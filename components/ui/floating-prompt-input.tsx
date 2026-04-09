'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AxiosError } from 'axios';
import { ArrowUp, ArrowDown, Loader2, ExternalLink, X, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import { CompactToolChain } from '@/components/chat/compact-tool-chain';
import { PastedContentCard } from '@/components/chat/pasted-content-card';
import { useRotatingText } from '@/lib/hooks/useRotatingText';
import { THINKING_PHRASES } from '@/lib/constants/thinking-phrases';
import { isToolMessage } from '@/types/chat';
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

const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Group consecutive tool messages (same logic as conversation page)
type MessageGroup =
  | { type: 'single'; message: ConversationMessage }
  | { type: 'tool-chain'; messages: ToolMessage[] };

function groupMessages(messages: ConversationMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];
    if (isToolMessage(msg)) {
      const toolMessages: ToolMessage[] = [msg];
      i++;
      while (i < messages.length && isToolMessage(messages[i])) {
        toolMessages.push(messages[i] as ToolMessage);
        i++;
      }
      groups.push({ type: 'tool-chain', messages: toolMessages });
    } else {
      groups.push({ type: 'single', message: msg });
      i++;
    }
  }

  return groups;
}

export function FloatingPromptInput({ className, contextSlug, contextType, contextTitle }: FloatingPromptInputProps) {
  const [input, setInput] = useState('');
  const [pastedContent, setPastedContent] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const router = useRouter();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const token = useAuthStore((state) => state.token);
  const eventSourceRef = useRef<EventSource | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const hasReconnectedRef = useRef<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  const sidebarWidth = isMobile ? '0px' : state === 'expanded' ? '16rem' : '3rem';

  const promptSuggestions = [
    'Explain this',
    'Quiz me 5 questions',
  ];

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  // Determine if we should show thinking indicator (same logic as conversation page)
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const showThinking = !!(isStreaming && lastMessage && lastMessage.role !== 'assistant');

  const { currentText: currentThinkingText } = useRotatingText({
    phrases: THINKING_PHRASES,
    intervalMs: 5000,
    mode: 'random',
    enabled: showThinking,
  });

  // Track scroll position — show scroll-to-bottom button when not at bottom
  const checkScrollPosition = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= 100;
    if (isNearBottomRef.current && showScrollDown) {
      setShowScrollDown(false);
    }
  }, [showScrollDown]);

  // Listen to scroll events
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollPosition);
    return () => el.removeEventListener('scroll', checkScrollPosition);
  }, [checkScrollPosition]);

  // When new messages arrive, show scroll button if not near bottom
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 100) {
      setShowScrollDown(true);
    }
  }, [messages]);

  const scrollToBottom = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  // Focus textarea inside sheet when it opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const textarea = sheetRef.current?.querySelector('textarea');
        textarea?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

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

  const connectToStream = useCallback(
    (executionId: string) => {
      if (!token) return;
      if (eventSourceRef.current) return;

      executionIdRef.current = executionId;
      setIsStreaming(true);

      const encodedToken = encodeURIComponent(token);
      const streamUrl = `${API_BASE_URL}/api/chat/stream/${executionId}?token=${encodedToken}`;

      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', () => {
        hasReconnectedRef.current = false;
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
        // Floating chat stays on legacy mode; `message` is the legacy alias
        // and `content` is the v2 canonical field. Prefer content, fall back.
        addAssistantMessage(event.content ?? event.message ?? '');
      });

      eventSource.addEventListener('end', () => {
        eventSource.close();
        eventSourceRef.current = null;
        executionIdRef.current = null;
        setIsStreaming(false);
        setIsCancelling(false);
      });

      eventSource.addEventListener('error', () => {
        eventSource.close();
        eventSourceRef.current = null;
        executionIdRef.current = null;
        setIsStreaming(false);
        setIsCancelling(false);
      });

      // Authoritative terminal for a user-initiated cancel. Fires after POST
      // /api/chat/stream/{id}/cancel. See chatApi.cancelStream for the contract.
      eventSource.addEventListener('cancelled', () => {
        eventSource.close();
        eventSourceRef.current = null;
        executionIdRef.current = null;
        setIsStreaming(false);
        setIsCancelling(false);
      });

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;

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
    const textarea = sheetRef.current?.querySelector('textarea');
    textarea?.focus();
  };

  // Graceful cancel — POSTs cancel and waits for a terminal SSE event
  // (`cancelled`/`end`/`error`). Does NOT close the EventSource locally.
  const handleCancel = () => {
    const execId = executionIdRef.current;
    if (!execId || !token || isCancelling) return;
    setIsCancelling(true);
    chatApi.cancelStream(execId, token);
  };

  const handleSubmit = async () => {
    const typedText = input.trim();
    const fullMessage = pastedContent
      ? `<pasted_content>${pastedContent}</pasted_content>${typedText ? '\n\n' + typedText : ''}`
      : typedText;
    if (!fullMessage || isSubmitting || isStreaming) return;

    setInput('');
    setPastedContent(null);
    setIsSubmitting(true);

    let messageToSend = fullMessage;
    if (!conversationId && contextSlug && contextType) {
      const slugTagMap = { case: 'case_slug', note: 'note_slug', statute: 'statute_slug' } as const;
      const slugTag = slugTagMap[contextType];
      messageToSend = `<${slugTag}>${contextSlug}</${slugTag}>\n\n${fullMessage}`;
    }

    const optimisticMsg = addUserMessage(typedText || '(pasted content)');

    try {
      const response = await chatApi.start({
        message: messageToSend,
        stream: true,
        conversation_id: conversationId ?? undefined,
      });

      if (response.success) {
        if (!conversationId) {
          setConversationId(response.data.conversation_id);
        }
        connectToStream(response.data.execution_id);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setError(response.message || 'Failed to send message');
        setIsStreaming(false);
      }
    } catch (err) {
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

  const canSend = !!(input.trim() || pastedContent);

  return (
    <>
      {/* Sheet — bottom on mobile, right sidebar on desktop */}
      {/* modal={false} allows page scroll while chat is open */}
      <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <SheetContent
          ref={sheetRef}
          side={isMobile ? 'bottom' : 'right'}
          showCloseButton={false}
          showOverlay={false}
          className={cn(
            'flex flex-col overflow-hidden p-0',
            !isMobile && 'sm:max-w-[420px] border-l shadow-xl',
            isMobile && 'rounded-t-2xl border-t shadow-2xl'
          )}
          style={isMobile ? { height: '70vh' } : undefined}
        >
          {/* Header — custom close + external link buttons */}
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-medium">
                {contextTitle ? (
                  <span>
                    <span className="text-yellow-600 dark:text-yellow-500">CHAT ABOUT:</span>{' '}
                    <span className="text-foreground">{contextTitle}</span>
                  </span>
                ) : (
                  'Assistant'
                )}
              </SheetTitle>
              <div className="flex items-center gap-1">
                {conversationId && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/c/${conversationId}`);
                    }}
                    className="rounded-md p-1.5 hover:bg-muted transition-colors"
                    aria-label="Open conversation in full page"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                <SheetClose asChild>
                  <button
                    className="rounded-md p-1.5 hover:bg-muted transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </SheetClose>
              </div>
            </div>
            <SheetDescription className="sr-only">
              Chat assistant for this {contextType || 'page'}
            </SheetDescription>
          </SheetHeader>

          {/* Chat messages — scrollable */}
          <div
            ref={chatContainerRef}
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="text-xs text-muted-foreground">Suggested prompts</p>
                <div className="flex w-full max-w-sm flex-col gap-2">
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
              <div className="flex flex-col gap-4">
                {messageGroups.map((group, groupIndex) => {
                  if (group.type === 'tool-chain') {
                    return (
                      <CompactToolChain
                        key={`tool-chain-${groupIndex}`}
                        messages={group.messages}
                      />
                    );
                  }

                  const message = group.message;
                  return (
                    <Message key={message.id} role={message.role as 'user' | 'assistant'}>
                      <MessageContent markdown={message.role === 'assistant'}>
                        {message.content}
                      </MessageContent>
                    </Message>
                  );
                })}

                {/* Thinking indicator — rotating verbs like conversation page */}
                {showThinking && (
                  <Message role="assistant">
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">{currentThinkingText}</span>
                    </div>
                  </Message>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scroll to bottom button */}
          {showScrollDown && (
            <div className="flex justify-center pb-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full shadow-md"
                onClick={scrollToBottom}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Input at bottom of sheet — matches conversation page */}
          <div className="shrink-0 border-t border-border p-3">
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
              {/* Pasted content preview */}
              {pastedContent && (
                <div className="mx-3 mt-2">
                  <PastedContentCard content={pastedContent} onRemove={() => setPastedContent(null)} />
                </div>
              )}

              {/* Textarea */}
              <PromptInputTextarea
                placeholder={pastedContent ? 'Add a message...' : 'Ask me anything'}
                className="text-foreground min-h-[36px] py-2 px-3"
                onLargePaste={setPastedContent}
              />

              {/* Send / Stop button — bottom right */}
              <div className="flex items-center justify-end px-2 pb-1">
                {isStreaming ? (
                  <PromptInputAction
                    tooltip={isCancelling ? 'Cancelling…' : 'Stop generating'}
                  >
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7 shrink-0 rounded-full disabled:opacity-70"
                      onClick={handleCancel}
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={isCancelling}
                      aria-label={isCancelling ? 'Cancelling' : 'Stop generating'}
                    >
                      {isCancelling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </PromptInputAction>
                ) : (
                  <PromptInputAction tooltip="Send message">
                    <Button
                      size="icon"
                      className="bg-primary hover:bg-primary/90 h-7 w-7 shrink-0 rounded-full"
                      onClick={handleSubmit}
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={!canSend || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </Button>
                  </PromptInputAction>
                )}
              </div>
            </PromptInput>
          </div>
        </SheetContent>
      </Sheet>

      {/* Fixed bottom input — visible when sheet is closed */}
      {!isOpen && (
        <div
          className={cn(
            'fixed bottom-4 z-50 right-0 px-4 transition-[left] duration-200 ease-linear',
            className
          )}
          style={{ left: sidebarWidth }}
        >
          <div className="mx-auto max-w-xs sm:max-w-md">
            <PromptInput
              value={input}
              onValueChange={setInput}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              maxHeight={36}
            >
              {/* Textarea — single line tap target */}
              <PromptInputTextarea
                placeholder="Ask a question..."
                className="text-foreground min-h-[36px] py-2 px-3"
                disableAutosize
                onFocus={() => setIsOpen(true)}
              />

              {/* Send button — bottom right */}
              <div className="flex items-center justify-end px-2 pb-1">
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
      )}
    </>
  );
}
