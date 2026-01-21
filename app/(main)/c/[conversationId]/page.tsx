'use client';

import { useEffect, useState, useRef } from 'react';
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
} from '@/components/prompt-kit';
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
      fetchConversationTitle(Number(conversationId));
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
    setConversationId(Number(conversationId));

    // If we have an execution ID, connect to the stream (coming from home page)
    if (executionId && initialMessage) {
      initializedRef.current = true;
      connectToStream(executionId, initialMessage);

      // Clean up URL params after connecting
      window.history.replaceState({}, '', `/c/${conversationId}`);
    } else {
      // Direct navigation - load conversation history
      initializedRef.current = true;
      loadConversationHistory(Number(conversationId));
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
        conversation_id: Number(conversationId),
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
        conversation_id: Number(conversationId),
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

  const renderMessage = (message: ConversationMessage) => {
    // Tool message
    if (isToolMessage(message)) {
      return (
        <div key={message.id} className="px-4">
          <div className="mx-auto max-w-2xl">
            <ToolMessageDisplay message={message} />
          </div>
        </div>
      );
    }

    // User or assistant message (role is guaranteed to be 'user' | 'assistant' here)
    const role = message.role as 'user' | 'assistant';
    return (
      <Message key={message.id} role={role} className="group">
        {message.role === 'assistant' ? (
          <>
            {/* Show message content */}
            {message.content && (
              <MessageContent
                className="prose prose-sm dark:prose-invert"
                markdown
              >
                {message.content}
              </MessageContent>
            )}
            {/* Message actions (visible on hover) */}
            {message.content && (
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
            {message.content}
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

  return (
    <ChatProvider sendMessage={sendMessage} isStreaming={isStreaming}>
      <div className="flex h-[calc(100vh-120px)] flex-col">
        {/* Chat messages */}
        <ChatContainerRoot className="flex-1 overflow-y-auto">
          <ChatContainerContent>
            {/* Loading history indicator */}
            {isLoadingHistory && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            )}

            {messages.map(renderMessage)}

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
