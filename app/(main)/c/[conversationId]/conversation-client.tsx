'use client';

import { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useChatStream } from '@/lib/hooks/useChatStream';
import {
  PromptInput,
  PromptInputTextarea,
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
import { SearchResultsList } from '@/components/chat/search-results-cards';
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
  Eye,
  Bot,
  ChevronDown,
  FileUp,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { isToolMessage, isHandoverMessage, isErrorMessage, type ToolMessage, type HandoverMessage, type ErrorMessage, type ConversationMessage, type ChatMessage } from '@/types/chat';
import { chatApi } from '@/lib/api/chat';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import { useRotatingText } from '@/lib/hooks/useRotatingText';
import { THINKING_PHRASES } from '@/lib/constants/thinking-phrases';
import { ChatProvider } from '@/lib/contexts/chat-context';
import { formatFileSize } from '@/lib/validations/admin-cases';
import { AddToFolderButton } from '@/components/folders';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

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

// Format agent slug to readable name
function formatAgentName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Message grouping types
type MessageGroup =
  | { type: 'single'; message: ConversationMessage }
  | { type: 'tool-chain'; messages: ToolMessage[] }
  | { type: 'handover-group'; handover: HandoverMessage; toolMessages: ToolMessage[] };

// Group consecutive tool messages together, and handover + tool chains into handover groups
function groupMessages(messages: ConversationMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (isHandoverMessage(msg)) {
      // Collect subsequent tool messages into the handover group
      const toolMessages: ToolMessage[] = [];
      i++;
      while (i < messages.length && isToolMessage(messages[i])) {
        toolMessages.push(messages[i] as ToolMessage);
        i++;
      }
      groups.push({ type: 'handover-group', handover: msg, toolMessages });
    } else if (isToolMessage(msg)) {
      // Regular tool chain (not part of a handover)
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
                      <SearchResultsList message={message} />
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

// Handover display component - renders agent delegation with nested tool calls
function HandoverDisplay({
  handover,
  toolMessages,
}: {
  handover: HandoverMessage;
  toolMessages: ToolMessage[];
}) {
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(false);
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

  const agentName = formatAgentName(handover.agentSlug);
  const isComplete = handover.handoverStatus === 'complete';
  const isTransfer = handover.handoverType === 'transfer';

  return (
    <div className="px-4">
      <div className="mx-auto max-w-2xl">
        {/* Agent header */}
        <Collapsible open={isTaskExpanded} onOpenChange={setIsTaskExpanded}>
          <CollapsibleTrigger asChild>
            <div className="hover:bg-muted/50 -mx-1 mb-1 cursor-pointer rounded-md px-1 py-1.5 transition-colors">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full',
                    isComplete
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isComplete ? (
                    <Bot className="h-3 w-3" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </div>
                <span className="text-sm font-medium">{agentName}</span>
                <div className="flex-1" />
                {isComplete && handover.latencyMs && (
                  <span className="text-muted-foreground text-xs">
                    completed {(handover.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
                {!isComplete && (
                  <span className="text-muted-foreground text-xs">
                    {isTransfer ? `handing over to ${agentName}...` : 'working...'}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'text-muted-foreground h-3.5 w-3.5 transition-transform duration-200',
                    isTaskExpanded && 'rotate-180'
                  )}
                />
              </div>
              {isComplete && (
                <p className="text-muted-foreground ml-7 text-[11px]">
                  {isTransfer ? 'Transferred' : 'Consulted'}
                </p>
              )}
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
            {handover.task && (
              <div className="mb-2 ml-7 rounded-md bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground text-xs italic">
                  &ldquo;{handover.task}&rdquo;
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Nested tool chain */}
        {toolMessages.length > 0 && (
          <div className="ml-2">
            <ChainOfThought>
              {toolMessages.map((message, index) => {
                const isStepComplete = message.toolStatus === 'complete';
                const isSuccess = isStepComplete && message.toolResult?.success;
                const isError = isStepComplete && !message.toolResult?.success;
                const isLast = index === toolMessages.length - 1;
                const isExpanded = expandedSteps.has(message.id);

                const status = !isStepComplete
                  ? 'loading'
                  : isSuccess
                    ? 'success'
                    : 'error';

                const { action, detail } = formatToolMessage(
                  message.toolName,
                  message.toolParameters,
                  isStepComplete
                );

                return (
                  <ChainOfThoughtStep
                    key={message.id}
                    isLast={isLast}
                    status={status}
                  >
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() =>
                        isStepComplete && toggleStep(message.id)
                      }
                    >
                      <CollapsibleTrigger asChild disabled={!isStepComplete}>
                        <ChainOfThoughtTrigger
                          isClickable={isStepComplete}
                          isExpanded={isExpanded}
                          rightContent={
                            isStepComplete && message.latencyMs
                              ? formatLatency(message.latencyMs)
                              : undefined
                          }
                        >
                          <span className="font-medium">{action}</span>
                          {detail && (
                            <span className="text-muted-foreground font-normal">
                              {' '}
                              {detail}
                            </span>
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
        )}

        {/* Agent response - expandable section (hidden for transfer to avoid duplicate content) */}
        {handover.handoverResultContent && isComplete && !isTransfer && (
          <div className="ml-2 mt-1">
            <Collapsible open={isResultExpanded} onOpenChange={setIsResultExpanded}>
              <CollapsibleTrigger asChild>
                <button className="hover:bg-muted/50 flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors">
                  <Eye className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground text-xs">
                    {isResultExpanded ? 'Hide' : 'View'} agent response
                  </span>
                  <ChevronDown
                    className={cn(
                      'text-muted-foreground h-3 w-3 transition-transform duration-200',
                      isResultExpanded && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border bg-muted/20 p-4">
                  <MessageContent
                    className="prose prose-sm dark:prose-invert"
                    markdown
                  >
                    {handover.handoverResultContent}
                  </MessageContent>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId as string;

  const [input, setInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ file_id: number; file_name: string; file_size: number } | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Conversation owner for read-only mode check
  const [conversationOwnerId, setConversationOwnerId] = useState<number | null>(null);

  // Get current user for ownership check
  const user = useAuthStore((state) => state.user);
  const isOwner = user?.id != null && conversationOwnerId != null && user.id === conversationOwnerId;

  // Sidebar state for input positioning
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const sidebarWidth = isMobile ? '0px' : state === 'expanded' ? '16rem' : '3rem';

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
    setError,
    retryLastMessage,
  } = useChatStream({
    onError: (err) => console.error('Chat error:', err),
  });

  const prevIsStreamingRef = useRef(isStreaming);
  const prevToolCountRef = useRef(0);

  const setOverride = useBreadcrumbStore((state) => state.setOverride);
  const clearOverride = useBreadcrumbStore((state) => state.clearOverride);

  // Auto-scroll only when new tool messages appear (not for text messages)
  useEffect(() => {
    const toolMessages = messages.filter(isToolMessage);
    const currentToolCount = toolMessages.length;

    // Only scroll if we have more tool messages than before
    if (currentToolCount > prevToolCountRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }

    prevToolCountRef.current = currentToolCount;
  }, [messages]);

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

    // Read attachment info from URL params (passed from home page)
    const fileId = searchParams.get('file_id');
    const fileName = searchParams.get('file_name');
    const fileSize = searchParams.get('file_size');
    const initialAttachment = fileId && fileName && fileSize
      ? { file_id: Number(fileId), file_name: fileName, file_size: Number(fileSize) }
      : undefined;

    // Set conversation ID
    setConversationId(conversationId);

    // If we have an execution ID, connect to the stream (coming from home page)
    if (executionId && initialMessage) {
      initializedRef.current = true;
      connectToStream(executionId, initialMessage, initialAttachment);

      // Clean up URL params after connecting
      window.history.replaceState({}, '', `/c/${conversationId}`);

      // For new conversations, the current user is the owner
      if (user?.id) {
        setConversationOwnerId(user.id);
      }
    } else {
      // Direct navigation - load conversation history
      initializedRef.current = true;
      loadConversationHistory(conversationId);

      // Fetch conversation metadata for ownership info
      chatApi.getConversation(conversationId).then((response) => {
        if (response.success && response.data) {
          setConversationOwnerId(response.data.user_id);
        }
      }).catch(() => {
        // Silently fail - the main loadConversationHistory will handle errors
      });
    }
  }, [conversationId, searchParams, connectToStream, setConversationId, loadConversationHistory, user?.id]);

  const handleSubmit = async () => {
    if ((!input.trim() && !uploadedFile) || isStreaming || isSubmitting || isUploading) return;

    const message = input.trim();
    if (!message) return;

    const attachment = uploadedFile ? { ...uploadedFile } : undefined;
    setInput('');
    setUploadedFile(null);
    setIsSubmitting(true);

    try {
      // Add user message with attachment info
      addUserMessage(message, attachment ? {
        file_id: attachment.file_id,
        file_name: attachment.file_name,
        file_size: attachment.file_size,
      } : undefined);

      // Scroll to bottom after sending
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);

      // Start new chat in same conversation
      const response = await chatApi.start({
        message,
        stream: true,
        conversation_id: conversationId,
        ...(attachment && { file_id: attachment.file_id }),
      });

      if (response.success) {
        connectToStream(response.data.execution_id);
      }
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilesAdded = async (newFiles: File[]) => {
    const pdfFile = newFiles[0];
    if (!pdfFile) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf',
      'text/rtf'
    ];
    if (!allowedTypes.includes(pdfFile.type)) {
      setError('Only PDF, DOC, DOCX, and RTF files are supported.');
      return;
    }
    if (pdfFile.size > MAX_DOCUMENT_SIZE) {
      setError('File size must be 10MB or less.');
      return;
    }

    if (error) setError(null);
    setUploadingFileName(pdfFile.name);
    setIsUploading(true);

    try {
      const uploadRes = await chatApi.uploadDocument(pdfFile);
      setUploadedFile({
        file_id: uploadRes.data.id,
        file_name: uploadRes.data.original_name,
        file_size: uploadRes.data.size,
      });
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError.message);
    } finally {
      setIsUploading(false);
      setUploadingFileName(null);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setUploadingFileName(null);
    setIsUploading(false);
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
      const apiError = extractApiError(err);
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group consecutive tool messages for chain display
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  const renderMessage = (message: ConversationMessage) => {
    // Error messages from backend (e.g. AUTH_ERROR, RATE_LIMITED)
    if (isErrorMessage(message)) {
      const errorMsg = message as ErrorMessage;
      return (
        <div key={errorMsg.id} className="flex justify-start px-4">
          <div className="mx-auto max-w-2xl w-full">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-destructive font-medium">{errorMsg.content}</p>
                {errorMsg.retryable && (
                  <p className="text-muted-foreground text-xs mt-0.5">You can try sending your message again.</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={retryLastMessage}
                disabled={isStreaming}
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

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
          <>
            <MessageContent className="bg-muted rounded-3xl px-5 py-2.5">
              {displayContent}
            </MessageContent>
            {/* Attachment badge for PDF files */}
            {(message as ChatMessage).attachment && (
              <div className="mt-1 flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground w-fit">
                <FileUp className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{(message as ChatMessage).attachment!.file_name}</span>
                <span>{formatFileSize((message as ChatMessage).attachment!.file_size)}</span>
              </div>
            )}
          </>
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
      {/* Chat messages */}
      <ChatContainerRoot ref={chatContainerRef} className="h-[calc(100vh-120px)] overflow-y-auto pb-28">
          <ChatContainerContent>
            {/* Context display and folder action */}
            {(contextSlug || (isOwner && messages.length > 0)) && (
              <div className="px-4 pb-4">
                <div className="mx-auto max-w-2xl flex items-center justify-between gap-2">
                  {contextSlug && contextType ? (
                    <p className="text-xs">
                      <span className="text-yellow-600 dark:text-yellow-500">
                        {contextType.toUpperCase()} CONTEXT:
                      </span>{' '}
                      <span className="font-medium text-foreground">{contextSlug}</span>
                    </p>
                  ) : (
                    <div />
                  )}
                  {isOwner && messages.length > 0 && (
                    <AddToFolderButton itemType="conversation" itemId={conversationId} variant="icon" />
                  )}
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
              if (group.type === 'handover-group') {
                return (
                  <HandoverDisplay
                    key={`handover-${groupIndex}`}
                    handover={group.handover}
                    toolMessages={group.toolMessages}
                  />
                );
              }
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

            {/* Connection-level error display (network drops, not API errors) */}
            {error && (
              <div className="flex justify-start px-4">
                <div className="mx-auto max-w-2xl w-full">
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-destructive font-medium flex-1">{error}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={retryLastMessage}
                      disabled={isStreaming}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            )}
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Input area - fixed at bottom */}
      <div
        className="fixed bottom-4 right-0 z-50 px-4 transition-[left] duration-200 ease-linear"
        style={{ left: sidebarWidth }}
      >
        <div className="mx-auto max-w-xs sm:max-w-md">
          {/* Show input for owners, view-only indicator for non-owners */}
          {isOwner ? (
            <FileUpload onFilesAdded={handleFilesAdded} accept=".pdf,.doc,.docx,.rtf" multiple={false}>
              <PromptInput
                value={input}
                onValueChange={setInput}
                onSubmit={handleSubmit}
                disabled={isStreaming || isLoadingHistory}
                maxHeight={36}
              >
                {/* Document File Preview - only shown when uploading or uploaded */}
                {(isUploading || uploadedFile) && (
                  <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
                    <div
                      className="bg-secondary flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileUp className="h-3 w-3" />
                      )}
                      <span className="max-w-[100px] truncate">
                        {uploadedFile?.file_name || uploadingFileName}
                      </span>
                      {uploadedFile && (
                        <span className="text-muted-foreground">{formatFileSize(uploadedFile.file_size)}</span>
                      )}
                      <button
                        onClick={removeFile}
                        className="hover:bg-secondary/50 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline input with buttons */}
                <div className="flex items-center gap-2 px-1">
                  {/* Attach button */}
                  <FileUploadTrigger asChild>
                    <button className="hover:bg-secondary-foreground/10 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-2xl">
                      <Paperclip className="text-primary h-4 w-4" />
                    </button>
                  </FileUploadTrigger>

                  {/* Textarea */}
                  <PromptInputTextarea
                    placeholder="Ask me anything"
                    className="text-foreground min-h-[36px] py-2"
                    disableAutosize
                  />

                  {/* Send/Stop button */}
                  {isStreaming ? (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7 shrink-0 rounded-full"
                      onClick={handleStop}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="bg-primary hover:bg-primary/90 h-7 w-7 shrink-0 rounded-full"
                      onClick={handleSubmit}
                      disabled={(!input.trim() && !uploadedFile) || isUploading}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </PromptInput>

              {/* Drag-and-drop overlay */}
              <FileUploadContent>
                <div className="flex min-h-[200px] w-full items-center justify-center">
                  <div className="bg-background/90 m-4 w-full max-w-md rounded-lg border p-8 shadow-lg">
                    <div className="mb-4 flex justify-center">
                      <FileUp className="text-muted-foreground h-8 w-8" />
                    </div>
                    <h3 className="mb-2 text-center text-base font-medium">
                      Drop document to upload
                    </h3>
                    <p className="text-muted-foreground text-center text-sm">
                      Release to attach document to your message
                    </p>
                  </div>
                </div>
              </FileUploadContent>
            </FileUpload>
          ) : (
            /* View-only indicator for non-owners */
            <div className="bg-muted/80 backdrop-blur rounded-full px-4 py-2 text-center text-sm text-muted-foreground border">
              <Eye className="inline-block h-4 w-4 mr-2" />
              View Only - This is a shared conversation
            </div>
          )}
        </div>
      </div>
    </ChatProvider>
  );
}

export default function ConversationClient() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ConversationPageContent />
    </Suspense>
  );
}
