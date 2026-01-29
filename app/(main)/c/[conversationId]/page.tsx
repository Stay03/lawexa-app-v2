'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useChatStream } from '@/lib/hooks/useChatStream';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import {
  FileUpload,
  FileUploadTrigger,
  FileUploadContent,
} from '@/components/ui/file-upload';
import {
  ChatContainerRoot,
  ChatContainerContent,
  Message,
  MessageContent,
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
} from '@/components/prompt-kit';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ToolCallDetails } from '@/components/chat/tool-call-details';
import {
  ArrowUp,
  Paperclip,
  X,
  Square,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isToolMessage, type ToolMessage, type ConversationMessage } from '@/types/chat';
import { chatApi } from '@/lib/api/chat';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { useRotatingText } from '@/lib/hooks/useRotatingText';
import { THINKING_PHRASES } from '@/lib/constants/thinking-phrases';
import { ChatProvider } from '@/lib/contexts/chat-context';

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
        action: isComplete ? 'Retrieved case details' : 'Retrieving case details',
        detail: parameters.case_id ? `for case #${parameters.case_id}` : undefined,
      };
    case 'get_note':
    case 'get_note_details':
      return {
        action: isComplete ? 'Retrieved note' : 'Retrieving note',
        detail: parameters.note_id ? `#${parameters.note_id}` : undefined,
      };
    default:
      // Fallback: convert snake_case to readable format
      const readable = toolName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        action: isComplete ? readable : `${readable}...`,
      };
  }
}

// Format latency in seconds
function formatLatency(ms: number): string {
  return `found in ${(ms / 1000).toFixed(2)}s`;
}

// Message grouping types
type MessageGroup =
  | { type: 'single'; message: ConversationMessage }
  | { type: 'tool-chain'; messages: ToolMessage[] };

// Group consecutive tool messages together
function groupMessages(messages: ConversationMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentToolGroup: ToolMessage[] = [];

  for (const message of messages) {
    if (isToolMessage(message)) {
      currentToolGroup.push(message);
    } else {
      // Flush any accumulated tool messages
      if (currentToolGroup.length > 0) {
        groups.push({ type: 'tool-chain', messages: currentToolGroup });
        currentToolGroup = [];
      }
      groups.push({ type: 'single', message });
    }
  }

  // Flush remaining tool messages
  if (currentToolGroup.length > 0) {
    groups.push({ type: 'tool-chain', messages: currentToolGroup });
  }

  return groups;
}

// Tool chain display component - renders linked tool calls
function ToolChainDisplay({ messages }: { messages: ToolMessage[] }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (messageId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  return (
    <div className="px-4">
      <div className="mx-auto max-w-2xl">
        <ChainOfThought>
          {messages.map((message, index) => {
            const isComplete = message.toolStatus === 'complete';
            const isSuccess = isComplete && message.toolResult?.success;
            const isError = isComplete && !message.toolResult?.success;
            const isLast = index === messages.length - 1;
            const isExpanded = expandedSteps.has(message.id);

            const status = !isComplete ? 'loading' : isSuccess ? 'success' : 'error';

            const { action, detail } = formatToolMessage(
              message.toolName,
              message.toolParameters,
              isComplete
            );

            return (
              <ChainOfThoughtStep
                key={message.id}
                isLast={isLast}
                status={status}
              >
                <Collapsible
                  open={isExpanded}
                  onOpenChange={() => isComplete && toggleStep(message.id)}
                >
                  <CollapsibleTrigger asChild disabled={!isComplete}>
                    <ChainOfThoughtTrigger
                      isClickable={isComplete}
                      isExpanded={isExpanded}
                      rightContent={
                        isComplete && message.latencyMs
                          ? formatLatency(message.latencyMs)
                          : undefined
                      }
                    >
                      <span className="font-medium">{action}</span>
                      {detail && (
                        <span className="text-muted-foreground font-normal"> {detail}</span>
                      )}
                    </ChainOfThoughtTrigger>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
                    <ChainOfThoughtContent>
                      <ToolCallDetails message={message} />
                    </ChainOfThoughtContent>
                  </CollapsibleContent>
                </Collapsible>

                {isError && !isExpanded && (
                  <p className="text-destructive mt-1 text-sm">
                    Error: {message.toolResult?.error || 'Unknown error'}
                  </p>
                )}
              </ChainOfThoughtStep>
            );
          })}
        </ChainOfThought>
      </div>
    </div>
  );
}

export default function ConversationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId as string;

  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);

  const {
    messages,
    isStreaming,
    isLoadingHistory,
    conversationTitle,
    error,
    connectToStream,
    loadConversationHistory,
    fetchConversationTitle,
    setConversationId,
    addUserMessage,
    disconnect,
  } = useChatStream({
    onError: (err) => console.error('Chat error:', err),
  });

  const prevIsStreamingRef = useRef(isStreaming);

  const setOverride = useBreadcrumbStore((state) => state.setOverride);
  const clearOverride = useBreadcrumbStore((state) => state.clearOverride);

  // Update breadcrumb when conversation title is loaded
  useEffect(() => {
    if (conversationTitle) {
      setOverride(conversationId, conversationTitle);
    }
    return () => {
      clearOverride(conversationId);
    };
  }, [conversationId, conversationTitle, setOverride, clearOverride]);

  // Fetch conversation title when streaming ends (for new conversations)
  useEffect(() => {
    // When streaming ends and we don't have a title yet, fetch it
    if (prevIsStreamingRef.current && !isStreaming && !conversationTitle) {
      fetchConversationTitle(conversationId);
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, conversationTitle, conversationId, fetchConversationTitle]);

  // Initialize on mount - connect to stream if coming from home page, or load history
  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initializedRef.current) return;

    const initialMessage = searchParams.get('msg');
    const executionId = searchParams.get('exec');

    // Set conversation ID
    setConversationId(conversationId);

    // If we have an execution ID, connect to the stream (coming from home page)
    if (executionId && initialMessage) {
      initializedRef.current = true;
      connectToStream(executionId, initialMessage);

      // Clean up URL params after connecting
      window.history.replaceState({}, '', `/c/${conversationId}`);
    } else {
      // Direct navigation - load conversation history
      initializedRef.current = true;
      loadConversationHistory(conversationId);
    }
  }, [conversationId, searchParams, connectToStream, setConversationId, loadConversationHistory]);

  const handleSubmit = async () => {
    if ((!input.trim() && files.length === 0) || isStreaming || isSubmitting) return;

    const message = input.trim();
    if (!message) return;

    setInput('');
    setFiles([]);
    setIsSubmitting(true);

    try {
      // Add user message first
      addUserMessage(message);

      // Start new chat in same conversation
      const response = await chatApi.start({
        message,
        stream: true,
        conversation_id: conversationId,
      });

      if (response.success) {
        // Connect to stream (don't pass message, already added above)
        connectToStream(response.data.execution_id);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilesAdded = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStop = () => {
    disconnect();
  };

  // Function to send a message programmatically (used by quiz components)
  const sendMessage = async (message: string) => {
    if (!message.trim() || isStreaming || isSubmitting) return;

    setIsSubmitting(true);

    try {
      addUserMessage(message);

      const response = await chatApi.start({
        message,
        stream: true,
        conversation_id: conversationId,
      });

      if (response.success) {
        connectToStream(response.data.execution_id);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group consecutive tool messages for chain display
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  const renderMessage = (message: ConversationMessage) => {
    // User or assistant message (role is guaranteed to be 'user' | 'assistant' here)
    const role = message.role as 'user' | 'assistant';

    // Strip XML tags from user message content if present
    let displayContent = message.content;
    if (message.role === 'user') {
      displayContent = message.content.replace(/<(case_slug|note_slug)>[^<]+<\/\1>\n\n/g, '');
    }

    return (
      <Message key={message.id} role={role} className="group">
        {message.role === 'assistant' ? (
          <>
            {/* Show message content */}
            {displayContent && (
              <MessageContent
                className="prose prose-sm dark:prose-invert"
                markdown
              >
                {displayContent}
              </MessageContent>
            )}
            {/* Message actions (visible on hover) */}
            {displayContent && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5">
                  <Copy className="h-4 w-4" />
                </button>
                <button className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5">
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5">
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <MessageContent className="bg-muted rounded-3xl px-5 py-2.5">
            {displayContent}
          </MessageContent>
        )}
      </Message>
    );
  };

  // Check if we need to show "Thinking..." indicator
  // Show it when streaming and the last message is NOT an assistant response
  // (i.e., still waiting for final response even if tool calls are happening)
  const lastMessage = messages[messages.length - 1];
  const showThinking = isStreaming && lastMessage && lastMessage.role !== 'assistant';

  // Dynamic rotating thinking text
  const { currentText: currentThinkingText } = useRotatingText({
    phrases: THINKING_PHRASES,
    intervalMs: 5000,
    mode: 'random',
    enabled: showThinking,
  });

  // Extract context from first user message if it contains XML tags
  const firstUserMessage = messages.find(m => m.role === 'user');
  const contextMatch = firstUserMessage?.content.match(/<(case_slug|note_slug)>([^<]+)<\/\1>/);
  const contextType = contextMatch ? contextMatch[1].replace('_slug', '') : null;
  // Extract just the slug text, removing any XML-like formatting
  const contextSlug = contextMatch ? contextMatch[2].trim() : null;

  return (
    <ChatProvider sendMessage={sendMessage} isStreaming={isStreaming}>
      <div className="flex h-[calc(100vh-120px)] flex-col">
        {/* Chat messages */}
        <ChatContainerRoot className="flex-1 overflow-y-auto">
          <ChatContainerContent>
            {/* Context text - Display case/note slug */}
            {contextSlug && contextType && (
              <div className="px-4 pb-4">
                <div className="mx-auto max-w-2xl">
                  <p className="text-xs">
                    <span className="text-yellow-600 dark:text-yellow-500">
                      {contextType.toUpperCase()} CONTEXT:
                    </span>{' '}
                    <span className="font-medium text-foreground">{contextSlug}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Loading history indicator */}
            {isLoadingHistory && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            )}

            {messageGroups.map((group, groupIndex) => {
              if (group.type === 'tool-chain') {
                return (
                  <ToolChainDisplay
                    key={`tool-chain-${groupIndex}`}
                    messages={group.messages}
                  />
                );
              }
              return renderMessage(group.message);
            })}

            {/* Thinking indicator - shown when streaming but no tool calls yet */}
            {showThinking && (
              <Message role="assistant" className="group">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{currentThinkingText}</span>
                </div>
              </Message>
            )}

            {/* Error display */}
            {error && (
              <div className="text-destructive py-2 text-center text-sm">
                {error}
              </div>
            )}
          </ChatContainerContent>
        </ChatContainerRoot>

      {/* Input area */}
      <div className="w-full px-4 pb-4">
        <div className="mx-auto max-w-2xl">
          <FileUpload onFilesAdded={handleFilesAdded} multiple>
            <PromptInput
              value={input}
              onValueChange={setInput}
              onSubmit={handleSubmit}
              disabled={isStreaming || isLoadingHistory}
            >
              {/* File Previews */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Paperclip className="h-4 w-4" />
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="hover:bg-secondary/50 rounded-full p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <PromptInputTextarea
                placeholder="Ask me anything"
                className="text-foreground"
              />

              <PromptInputActions className="flex items-center justify-between px-3 pb-3">
                {/* Attach button - LEFT */}
                <PromptInputAction tooltip="Attach files">
                  <FileUploadTrigger asChild>
                    <div className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl">
                      <Paperclip className="text-primary h-5 w-5" />
                    </div>
                  </FileUploadTrigger>
                </PromptInputAction>

                {/* Send/Stop button - RIGHT */}
                <PromptInputAction
                  tooltip={isStreaming ? 'Stop' : 'Send message'}
                >
                  {isStreaming ? (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 rounded-full"
                      onClick={handleStop}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="bg-primary hover:bg-primary/90 h-8 w-8 rounded-full"
                      onClick={handleSubmit}
                      disabled={!input.trim() && files.length === 0}
                    >
                      <ArrowUp className="h-5 w-5" />
                    </Button>
                  )}
                </PromptInputAction>
              </PromptInputActions>
            </PromptInput>

            {/* Drag-and-drop overlay */}
            <FileUploadContent>
              <div className="flex min-h-[200px] w-full items-center justify-center">
                <div className="bg-background/90 m-4 w-full max-w-md rounded-lg border p-8 shadow-lg">
                  <div className="mb-4 flex justify-center">
                    <Paperclip className="text-muted-foreground h-8 w-8" />
                  </div>
                  <h3 className="mb-2 text-center text-base font-medium">
                    Drop files to upload
                  </h3>
                  <p className="text-muted-foreground text-center text-sm">
                    Release to add files to your message
                  </p>
                </div>
              </div>
            </FileUploadContent>
          </FileUpload>
        </div>
      </div>
    </div>
    </ChatProvider>
  );
}
