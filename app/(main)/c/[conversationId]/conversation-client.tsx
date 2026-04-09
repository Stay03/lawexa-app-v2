'use client';

import { Fragment, Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useChatStream } from '@/lib/hooks/useChatStream';
import { useCaseMentionTooltips } from '@/lib/hooks/useCaseMentionTooltips';
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
} from '@/components/prompt-kit';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CompactToolChain } from '@/components/chat/compact-tool-chain';
import { PastedContentCard } from '@/components/chat/pasted-content-card';
import {
  ArrowDown,
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
import { cn, stripPastedTags } from '@/lib/utils';
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
import { useGuestAuth } from '@/lib/hooks/useGuestAuth';
import { ConversationNotAvailable } from '@/components/conversations';
import { ErrorState } from '@/components/common/ErrorState';
import { browserNotify } from '@/lib/utils/browser-notify';
import { hasPromptContent } from '@/lib/utils/parse-content-xml';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

// Format elapsed seconds into human-readable time
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
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

// Tool chain display component - compact animated view
function ToolChainDisplay({ messages }: { messages: ToolMessage[] }) {
  return (
    <div className="px-4">
      <div className="mx-auto max-w-2xl">
        <CompactToolChain messages={messages} />
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
  const isComplete = handover.handoverStatus === 'complete';
  const [isTaskExpanded, setIsTaskExpanded] = useState(!isComplete);
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const hasAutoCollapsed = useRef(false);

  const agentName = formatAgentName(handover.agentSlug);
  const isTransfer = handover.handoverType === 'transfer';

  // 3-stage status: consulting → working → consulted
  const stage = isComplete
    ? 'consulted'
    : toolMessages.length > 0
      ? 'working'
      : 'consulting';

  // Auto-collapse when handover completes
  useEffect(() => {
    if (isComplete && !hasAutoCollapsed.current) {
      hasAutoCollapsed.current = true;
      setIsTaskExpanded(false);
    }
  }, [isComplete]);

  // Auto-collapse task after 5 seconds while active
  useEffect(() => {
    if (!isComplete && isTaskExpanded && !hasAutoCollapsed.current) {
      const timer = setTimeout(() => {
        hasAutoCollapsed.current = true;
        setIsTaskExpanded(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, isTaskExpanded]);

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
                <span className="text-sm font-medium">
                  {stage === 'consulting' && (isTransfer ? `Transferring to ${agentName}...` : `Consulting ${agentName}...`)}
                  {stage === 'working' && `${agentName} working...`}
                  {stage === 'consulted' && (isTransfer ? `Transferred to ${agentName}` : `Consulted ${agentName}`)}
                </span>
                <div className="flex-1" />
                {isComplete && handover.latencyMs && (
                  <span className="text-muted-foreground text-xs">
                    {(handover.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'text-muted-foreground h-3.5 w-3.5 transition-transform duration-200',
                    isTaskExpanded && 'rotate-180'
                  )}
                />
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
            {handover.task && (
              <div className="mb-2 ml-7 rounded-md bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground text-sm italic leading-relaxed">
                  &ldquo;{handover.task}&rdquo;
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Nested tool chain */}
        {toolMessages.length > 0 && (
          <div className="ml-2">
            <CompactToolChain messages={toolMessages} showSearchResults={false} />
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

const USER_MESSAGE_TRUNCATE_LENGTH = 1000;

function UserMessageContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = content.length > USER_MESSAGE_TRUNCATE_LENGTH;

  return (
    <MessageContent className="bg-muted rounded-3xl px-5 py-2.5">
      {shouldTruncate && !expanded ? (
        <div>
          <div className="relative max-h-[200px] overflow-hidden">
            {content.slice(0, USER_MESSAGE_TRUNCATE_LENGTH)}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-muted to-transparent" />
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="text-muted-foreground hover:text-foreground mt-1 text-xs"
          >
            Show more
          </button>
        </div>
      ) : (
        <div>
          {content}
          {shouldTruncate && (
            <button
              onClick={() => setExpanded(false)}
              className="text-muted-foreground hover:text-foreground mt-1 block text-xs"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </MessageContent>
  );
}

function ConversationPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId as string;

  // Guest auth — acquire token if user is unauthenticated
  const { isReady: isGuestReady, isLoading: isGuestLoading, error: guestError } = useGuestAuth();

  const [input, setInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`conversation_draft_${conversationId}`) ?? '';
  });
  const [pastedContent, setPastedContent] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`conversation_draft_pasted_${conversationId}`) || null;
  });
  const [uploadedFile, setUploadedFile] = useState<{ file_id: number; file_name: string; file_size: number } | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  // Per-conversation opt-in for token-level streaming. Seeded from the home
  // page init blob; resets on hard refresh (follow-ups fall back to legacy).
  const streamModeRef = useRef<'v2_stream' | undefined>(undefined);

  // Conversation owner for read-only mode check
  const [conversationOwnerId, setConversationOwnerId] = useState<number | null>(null);

  // Sync input draft to localStorage
  useEffect(() => {
    if (input) {
      localStorage.setItem(`conversation_draft_${conversationId}`, input);
    } else {
      localStorage.removeItem(`conversation_draft_${conversationId}`);
    }
  }, [input, conversationId]);

  // Sync pasted content to localStorage
  useEffect(() => {
    if (pastedContent) {
      localStorage.setItem(`conversation_draft_pasted_${conversationId}`, pastedContent);
    } else {
      localStorage.removeItem(`conversation_draft_pasted_${conversationId}`);
    }
  }, [pastedContent, conversationId]);

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
    isCancelling,
    isLoadingHistory,
    conversationTitle,
    error,
    send,
    connectToStream,
    loadConversationHistory,
    fetchConversationTitle,
    setConversationId,
    disconnect,
    cancelStream,
    setError,
    retryLastMessage,
    recoverPendingState,
  } = useChatStream({
    onError: (err) => console.error('Chat error:', err),
    onHistoryLoaded: (data) => setConversationOwnerId(data.user_id),
    onCompleted: (event) => {
      // Prefer canonical `content` (v2_stream), fall back to legacy `message`
      const finalText = event.content ?? event.message ?? '';
      if (hasPromptContent(finalText)) {
        browserNotify('Action Required', 'Lawexa needs your input to continue.');
      }
    },
  });

  const prevIsStreamingRef = useRef(isStreaming);

  const setOverride = useBreadcrumbStore((state) => state.setOverride);
  const clearOverride = useBreadcrumbStore((state) => state.clearOverride);


  // Update breadcrumb when conversation title is loaded
  useEffect(() => {
    if (conversationTitle) {
      setOverride(conversationId, stripPastedTags(conversationTitle));
    }
    return () => {
      clearOverride(conversationId);
    };
  }, [conversationId, conversationTitle, setOverride, clearOverride]);

  // Case hover previews — re-trigger when assistant messages change
  const lastAssistantContent = useMemo(() => {
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    return assistantMsgs[assistantMsgs.length - 1]?.content || null;
  }, [messages]);

  useCaseMentionTooltips({
    containerRef: chatContentRef,
    enabled: true,
    content: lastAssistantContent,
  });

  // Fetch conversation title when streaming ends (for new conversations)
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming) {
      // Fetch title if we don't have one yet
      if (!conversationTitle) {
        fetchConversationTitle(conversationId);
      }
      // Notify user that execution is complete
      browserNotify('Research Complete', 'Lawexa has finished processing your request.');
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, conversationTitle, conversationId, fetchConversationTitle]);

  // Initialize on mount - connect to stream if coming from home page, or load history
  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initializedRef.current) return;
    // Wait for auth (guest token or real user) before making API calls
    if (!isGuestReady) return;

    // Read init data from sessionStorage (set by home page) or fall back to URL params
    const initKey = `conv_init_${conversationId}`;
    const storedInit = sessionStorage.getItem(initKey);
    let initialMessage: string | null = null;
    let executionId: string | null = null;
    let initialAttachment: { file_id: number; file_name: string; file_size: number } | undefined;

    if (storedInit) {
      const parsed = JSON.parse(storedInit);
      initialMessage = parsed.msg;
      executionId = parsed.exec;
      if (parsed.file_id && parsed.file_name && parsed.file_size) {
        initialAttachment = { file_id: parsed.file_id, file_name: parsed.file_name, file_size: parsed.file_size };
      }
      // Seed per-conversation stream mode so follow-up sends keep using v2
      if (parsed.stream_mode === 'v2_stream') {
        streamModeRef.current = 'v2_stream';
      }
      sessionStorage.removeItem(initKey);
    } else {
      // Legacy fallback for URL params
      initialMessage = searchParams.get('msg');
      executionId = searchParams.get('exec');
      const fileId = searchParams.get('file_id');
      const fileName = searchParams.get('file_name');
      const fileSize = searchParams.get('file_size');
      initialAttachment = fileId && fileName && fileSize
        ? { file_id: Number(fileId), file_name: fileName, file_size: Number(fileSize) }
        : undefined;
    }

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
      // Direct navigation or page refresh during stream
      initializedRef.current = true;

      // Always load history first, then check if there's a pending stream to reconnect to.
      // This is more reliable than localStorage (which can be lost on hard refresh).
      (async () => {
        await loadConversationHistory(conversationId);

        // After history is loaded, check if the AI is still processing
        const result = await recoverPendingState(conversationId);
        // If 'reconnected', recoverPendingState already set isStreaming and connected.
        // Otherwise, history is loaded — nothing else to do.
        // If reconnected, ChatContainerRoot's scroll-to-bottom button will handle it
      })();
    }
  }, [conversationId, searchParams, connectToStream, setConversationId, loadConversationHistory, recoverPendingState, user?.id, isGuestReady]);

  const handleSubmit = async () => {
    if ((!input.trim() && !uploadedFile && !pastedContent) || isStreaming || isSubmitting || isUploading) return;

    const typedText = input.trim();
    const fullMessage = pastedContent
      ? `<pasted_content>${pastedContent}</pasted_content>${typedText ? '\n\n' + typedText : ''}`
      : typedText;
    if (!fullMessage) return;

    const attachment = uploadedFile ? { ...uploadedFile } : undefined;
    setInput('');
    setPastedContent(null);
    localStorage.removeItem(`conversation_draft_${conversationId}`);
    localStorage.removeItem(`conversation_draft_pasted_${conversationId}`);
    setUploadedFile(null);
    setIsSubmitting(true);

    // Scroll to bottom after sending
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 100);

    await send(fullMessage, {
      conversationId,
      fileId: attachment?.file_id,
      attachment: attachment ? {
        file_id: attachment.file_id,
        file_name: attachment.file_name,
        file_size: attachment.file_size,
      } : undefined,
      streamMode: streamModeRef.current,
    });

    setIsSubmitting(false);
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
    // POST cancel + optimistic "Cancelling…". The stream stays open until
    // the backend confirms via a terminal SSE event (`cancelled`/`completed`
    // /`error`/`timeout`). Do NOT call disconnect() here.
    cancelStream();
  };

  // Function to send a message programmatically (used by quiz components)
  const sendMessage = async (message: string) => {
    if (!message.trim() || isStreaming || isSubmitting) return;

    setIsSubmitting(true);
    await send(message, { conversationId, streamMode: streamModeRef.current });
    setIsSubmitting(false);
  };

  // Group consecutive tool messages for chain display
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  const renderMessage = (message: ConversationMessage, { isInteracted = false }: { isInteracted?: boolean } = {}) => {
    // Error messages from backend (e.g. AUTH_ERROR, RATE_LIMITED)
    if (isErrorMessage(message)) {
      const errorMsg = message as ErrorMessage;
      const isExhausted = errorMsg.errorCode === 'MESSAGES_EXHAUSTED';
      return (
        <div key={errorMsg.id} className="flex justify-start px-4">
          <div className="mx-auto max-w-2xl w-full">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1">
                {isExhausted ? (
                  <p className="text-destructive font-medium">
                    You&apos;ve reached your AI message limit for this plan.{' '}
                    <Link href="/pricing" className="underline hover:text-destructive/80">
                      Upgrade to Pro
                    </Link>{' '}
                    for a higher monthly limit, or{' '}
                    <Link href="/pricing?tab=payg" className="underline hover:text-destructive/80">
                      Buy more messages
                    </Link>{' '}
                    to keep the conversation going right now.
                  </p>
                ) : (
                  <>
                    <p className="text-destructive font-medium">{errorMsg.content}</p>
                    {errorMsg.retryable && (
                      <p className="text-muted-foreground text-xs mt-0.5">You can try sending your message again.</p>
                    )}
                  </>
                )}
              </div>
              {!isExhausted && (
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
              )}
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

    // Parse pasted content from user messages
    const pastedMatch = message.role === 'user'
      ? displayContent.match(/<pasted_content>([\s\S]*?)<\/pasted_content>/)
      : null;
    const messagePastedText = pastedMatch ? pastedMatch[1].trim() : null;
    const messageRemainingText = pastedMatch
      ? displayContent.replace(/<pasted_content>[\s\S]*?<\/pasted_content>\s*/, '').trim()
      : null;

    return (
      <Message key={message.id} role={role} className="group">
        {message.role === 'assistant' ? (
          <>
            {/* Show message content */}
            {displayContent && (
              <MessageContent
                className="prose prose-sm dark:prose-invert"
                markdown
                isInteracted={isInteracted}
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
            {messagePastedText ? (
              <>
                <PastedContentCard content={messagePastedText} />
                {messageRemainingText && (
                  <MessageContent className="bg-muted rounded-3xl px-5 py-2.5 mt-1.5">
                    {messageRemainingText}
                  </MessageContent>
                )}
              </>
            ) : (
              <UserMessageContent content={displayContent} />
            )}
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

  // Stream elapsed timer — derive start from first tool/handover message timestamp
  const streamStartTime = useMemo(() => {
    for (const msg of messages) {
      if (isToolMessage(msg) || isHandoverMessage(msg)) {
        return msg.timestamp.getTime();
      }
    }
    return null;
  }, [messages]);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!streamStartTime) {
      setElapsed(0);
      return;
    }

    if (!isStreaming) {
      // Streaming done — freeze at final elapsed
      const last = messages[messages.length - 1];
      if (last) {
        setElapsed(Math.floor((last.timestamp.getTime() - streamStartTime) / 1000));
      }
      return;
    }

    // Live ticking — set initial immediately (handles refresh mid-stream)
    setElapsed(Math.floor((Date.now() - streamStartTime) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - streamStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [streamStartTime, isStreaming, messages]);

  // Extract context from first user message if it contains XML tags
  const firstUserMessage = messages.find(m => m.role === 'user');
  const contextMatch = firstUserMessage?.content.match(/<(case_slug|note_slug)>([^<]+)<\/\1>/);
  const contextType = contextMatch ? contextMatch[1].replace('_slug', '') : null;
  // Extract just the slug text, removing any XML-like formatting
  const contextSlug = contextMatch ? contextMatch[2].trim() : null;

  // Guest auth loading state
  if (isGuestLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // Guest auth error
  if (guestError) {
    return (
      <ErrorState
        title="Unable to load conversation"
        description="We couldn't establish a connection. Please try refreshing the page."
      />
    );
  }
  // Conversation not found (private, archived, or doesn't exist)
  if (error === 'not_found') {
    return <ConversationNotAvailable />;
  }

  return (
    <ChatProvider sendMessage={sendMessage} isStreaming={isStreaming}>
      {/* Chat messages */}
      <ChatContainerRoot ref={chatContainerRef} className="h-[calc(100vh-120px)] overflow-y-auto pb-28" onScrollStateChange={setShowScrollDown}>
          <ChatContainerContent ref={chatContentRef}>
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
              // Show elapsed timer right before the first tool-chain or handover group
              const isToolGroup = group.type === 'tool-chain' || group.type === 'handover-group';
              const isFirstToolGroup = isToolGroup && !messageGroups.slice(0, groupIndex).some(
                g => g.type === 'tool-chain' || g.type === 'handover-group'
              );
              const timerElement = isFirstToolGroup && streamStartTime && elapsed > 0 ? (
                <div key="elapsed-timer" className="px-4 mb-1">
                  <div className="mx-auto max-w-2xl flex justify-end">
                    <span className="text-muted-foreground text-xs">
                      {isStreaming
                        ? `Processing · ${formatElapsed(elapsed)}`
                        : `Worked for ${formatElapsed(elapsed)}`}
                    </span>
                  </div>
                </div>
              ) : null;

              if (group.type === 'handover-group') {
                return (
                  <Fragment key={`handover-${groupIndex}`}>
                    {timerElement}
                    <HandoverDisplay
                      handover={group.handover}
                      toolMessages={group.toolMessages}
                    />
                  </Fragment>
                );
              }
              if (group.type === 'tool-chain') {
                return (
                  <Fragment key={`tool-chain-${groupIndex}`}>
                    {timerElement}
                    <ToolChainDisplay
                      messages={group.messages}
                    />
                  </Fragment>
                );
              }
              // Check if this assistant message has been interacted with
              // (i.e., a user message follows it in the conversation)
              const isInteracted = group.message.role === 'assistant' && messageGroups.slice(groupIndex + 1).some(
                g => g.type === 'single' && g.message.role === 'user'
              );
              return renderMessage(group.message, { isInteracted });
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
        {/* Scroll to bottom button - sits above the input */}
        {showScrollDown && (
          <div className="flex justify-center mb-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full shadow-lg"
              onClick={() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })}
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </div>
        )}
        <div className="mx-auto max-w-xs sm:max-w-md">
          {/* Show input for owners, view-only indicator for non-owners */}
          {isOwner ? (
            <FileUpload onFilesAdded={handleFilesAdded} accept=".pdf,.doc,.docx,.rtf" multiple={false}>
              <PromptInput
                value={input}
                onValueChange={setInput}
                onSubmit={handleSubmit}
                disabled={isStreaming || isLoadingHistory || isSubmitting}
                maxHeight={150}
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

                {/* Pasted content preview */}
                {pastedContent && (
                  <div className="mx-3 mt-2">
                    <PastedContentCard content={pastedContent} onRemove={() => setPastedContent(null)} />
                  </div>
                )}

                {/* Textarea - full width */}
                <PromptInputTextarea
                  placeholder={pastedContent ? 'Add a message...' : 'Ask me anything'}
                  className="text-foreground min-h-[36px] py-2 px-3"
                  onLargePaste={setPastedContent}
                />

                {/* Bottom bar: attach left, send right */}
                <div className="flex items-center justify-between px-2 pb-1">
                  <FileUploadTrigger asChild>
                    <button className="hover:bg-secondary-foreground/10 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-2xl">
                      <Paperclip className="text-primary h-4 w-4" />
                    </button>
                  </FileUploadTrigger>

                  {/* Send/Stop button */}
                  {isStreaming ? (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7 shrink-0 rounded-full disabled:opacity-70"
                      onClick={handleStop}
                      disabled={isCancelling}
                      aria-label={isCancelling ? 'Cancelling' : 'Stop generating'}
                    >
                      {isCancelling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="bg-primary hover:bg-primary/90 h-7 w-7 shrink-0 rounded-full"
                      onClick={handleSubmit}
                      disabled={(!input.trim() && !uploadedFile && !pastedContent) || isUploading || isSubmitting}
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
