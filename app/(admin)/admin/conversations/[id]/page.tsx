'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChatContainerRoot,
  ChatContainerContent,
  Message,
  MessageContent,
} from '@/components/prompt-kit';
import { CompactToolChain } from '@/components/chat/compact-tool-chain';
import { useAdminConversation } from '@/lib/hooks/useAdmin';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { formatCost } from '@/lib/utils/currency';
import { formatFileSize } from '@/lib/validations/admin-cases';
import {
  ArrowLeft,
  Lock,
  Globe,
  MessageSquare,
  Calendar,
  Bot,
  User,
  Coins,
  Hash,
  Eye,
  ChevronDown,
  FileUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn, stripContextTags } from '@/lib/utils';
import type { AdminMessage } from '@/types/admin';
import type { ConversationMessage, ToolMessage, HandoverMessage, MessageAttachment, ChatMessage } from '@/types/chat';
import { isHandoverMessage } from '@/types/chat';

// Convert AdminMessage to ConversationMessage for chat components
function convertAdminMessages(
  adminMessages: AdminMessage[]
): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  // Build lists of handover_result messages by iteration (lists handle iteration resets across executions)
  const handoverResultsByIteration = new Map<number, AdminMessage[]>();
  adminMessages.forEach((msg) => {
    if (
      msg.role === 'assistant' &&
      msg.metadata?.type === 'handover_result' &&
      msg.metadata.iteration !== undefined
    ) {
      const list = handoverResultsByIteration.get(msg.metadata.iteration) || [];
      list.push(msg);
      handoverResultsByIteration.set(msg.metadata.iteration, list);
    }
  });

  // Build lists of tool_result messages by iteration for pairing with tool_calls
  const toolResultsByIteration = new Map<number, AdminMessage[]>();
  adminMessages.forEach((msg) => {
    if (
      msg.role === 'tool' &&
      msg.metadata?.type === 'tool_result' &&
      msg.metadata.iteration !== undefined
    ) {
      const list = toolResultsByIteration.get(msg.metadata.iteration) || [];
      list.push(msg);
      toolResultsByIteration.set(msg.metadata.iteration, list);
    }
  });

  for (const msg of adminMessages) {
    const base = {
      id: String(msg.id),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
    };

    // Extract attachment from metadata if present
    let attachment: MessageAttachment | undefined;
    if (msg.metadata?.file_id && msg.metadata?.file_name && msg.metadata?.file_size) {
      attachment = {
        file_id: msg.metadata.file_id,
        file_name: msg.metadata.file_name,
        file_size: msg.metadata.file_size,
      };
    }

    // Handle handover messages - orchestrator delegating to sub-agent
    if (msg.role === 'assistant' && msg.metadata?.type === 'handover') {
      const iteration = msg.metadata.iteration;
      const handoverResult =
        iteration !== undefined
          ? handoverResultsByIteration.get(iteration)?.shift()
          : undefined;

      let handoverResultContent: string | undefined;
      if (handoverResult) {
        const content = handoverResult.content;
        if (content && !content.startsWith('{')) {
          handoverResultContent = content;
        }
      }

      messages.push({
        id: String(msg.id),
        role: 'assistant',
        content: '',
        timestamp: new Date(msg.created_at),
        messageType: 'handover',
        agentSlug: msg.metadata.target_agent || 'agent',
        task: msg.metadata.task || '',
        handoverStatus: 'complete',
        handoverType: handoverResult?.metadata?.handover_type || msg.metadata.handover_type || 'consult',
        latencyMs: handoverResult?.metadata?.latency_ms,
        success: handoverResult?.metadata?.success ?? true,
        handoverResultContent,
      } as HandoverMessage);
      continue;
    }

    // Skip handover_result messages (already captured above)
    if (msg.role === 'assistant' && msg.metadata?.type === 'handover_result') {
      continue;
    }

    // Handle tool_call messages - pair with tool_result to get both parameters AND result data
    if (msg.role === 'assistant' && msg.metadata?.type === 'tool_call') {
      const toolResult = msg.metadata.iteration !== undefined
        ? toolResultsByIteration.get(msg.metadata.iteration)?.shift()
        : undefined;

      // Parse tool result data from the paired tool_result message
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
        ...base,
        role: 'tool' as const,
        toolName: msg.metadata.tool_name || 'unknown',
        toolParameters: msg.metadata.tool_parameters || {},
        toolResult: parsedToolResult,
        toolStatus: 'complete' as const,
        latencyMs: toolResult?.metadata?.latency_ms || toolResult?.metadata?.execution_time_ms,
      } as ToolMessage);
      continue;
    }

    // Skip tool_result messages (already captured via tool_call pairing above)
    if (msg.role === 'tool' && msg.metadata?.type === 'tool_result') {
      continue;
    }

    // Regular message (user or assistant)
    messages.push({
      ...base,
      ...(attachment && { attachment }),
    } as ConversationMessage);
  }

  return messages;
}

// Type guard for tool messages
function isToolMessage(message: ConversationMessage): message is ToolMessage {
  return message.role === 'tool';
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

// Format agent slug to readable name
function formatAgentName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

  const agentName = formatAgentName(handover.agentSlug);
  const isTransfer = handover.handoverType === 'transfer';

  return (
    <div className="px-4">
      <div className="mx-auto max-w-2xl">
        {/* Agent header */}
        <Collapsible open={isTaskExpanded} onOpenChange={setIsTaskExpanded}>
          <CollapsibleTrigger asChild>
            <div className="hover:bg-muted/50 -mx-1 mb-1 cursor-pointer rounded-md px-1 py-1.5 transition-colors">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 text-primary flex h-5 w-5 items-center justify-center rounded-full">
                  <Bot className="h-3 w-3" />
                </div>
                <span className="text-sm font-medium">
                  {isTransfer ? `Transferred to ${agentName}` : `Consulted ${agentName}`}
                </span>
                <div className="flex-1" />
                {handover.latencyMs && (
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
        {handover.handoverResultContent && !isTransfer && (
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

// Tool chain display component
function ToolChainDisplay({ messages }: { messages: ToolMessage[] }) {
  return (
    <div className="px-4">
      <div className="mx-auto max-w-2xl">
        <CompactToolChain messages={messages} />
      </div>
    </div>
  );
}

interface AdminConversationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminConversationDetailPage({
  params,
}: AdminConversationDetailPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useAdminConversation(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();
  const { exchangeRate, showNGN } = useCurrencyStore();

  // Set breadcrumb label to conversation title
  useEffect(() => {
    if (data?.data?.title) {
      setOverride(id, data.data.title);
    }
    return () => {
      clearOverride(id);
    };
  }, [data?.data?.title, id, setOverride, clearOverride]);

  // Convert and group messages
  const messages = useMemo(() => {
    if (!data?.data?.messages) return [];
    return convertAdminMessages(data.data.messages);
  }, [data?.data?.messages]);

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-28" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 lg:shrink-0 space-y-3">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-6 w-32" />
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="flex-1 h-[80vh] rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/conversations">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Conversations
          </Button>
        </Link>
        <div className="rounded-lg border py-8 text-center text-muted-foreground">
          Conversation not found
        </div>
      </div>
    );
  }

  const conversation = data.data;

  const renderMessage = (message: ConversationMessage) => {
    const role = message.role as 'user' | 'assistant';

    // Strip the inline content-context tags from user messages.
    let displayContent = message.content;
    if (message.role === 'user') {
      displayContent = stripContextTags(message.content);
    }

    return (
      <Message key={message.id} role={role} className="group">
        {message.role === 'assistant' ? (
          displayContent && (
            <MessageContent className="prose prose-sm dark:prose-invert" markdown>
              {displayContent}
            </MessageContent>
          )
        ) : (
          <>
            <MessageContent className="bg-muted rounded-3xl px-5 py-2.5">
              {displayContent}
            </MessageContent>

            {/* Attachment badge */}
            {(message as ChatMessage).attachment && (
              <div className="mt-1 flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground w-fit">
                <FileUp className="h-3 w-3" />
                <span className="max-w-[150px] truncate">
                  {(message as ChatMessage).attachment!.file_name}
                </span>
                <span>{formatFileSize((message as ChatMessage).attachment!.file_size)}</span>
              </div>
            )}
          </>
        )}
      </Message>
    );
  };

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Link href="/admin/conversations">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Conversations
        </Button>
      </Link>

      {/* Main Layout: Sidebar + Message History */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - Title, Badges & Stats */}
        <div className="lg:w-56 lg:shrink-0 space-y-3">
          {/* Title & ID */}
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {conversation.title || 'Untitled Conversation'}
            </h1>
            <p className="text-xs text-muted-foreground font-mono break-all mt-1">
              {conversation.id}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                conversation.status === 'active' ? 'default' : 'secondary'
              }
            >
              {conversation.status}
            </Badge>
            {conversation.is_private ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" /> Private
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 text-green-600 border-green-600"
              >
                <Globe className="h-3 w-3" /> Public
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="rounded-lg border border-muted p-3">
            <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
              <User className="h-3.5 w-3.5" /> User UUID
            </p>
            <p className="font-mono text-xs break-all">
              {conversation.user_uuid}
            </p>
          </div>
          <div className="rounded-lg border border-muted p-3">
            <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
              <Bot className="h-3.5 w-3.5" /> Agent
            </p>
            <p className="text-sm font-medium">{conversation.agent?.name || '-'}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="rounded-lg border border-muted p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
                <MessageSquare className="h-3.5 w-3.5" /> Messages
              </p>
              <p className="text-sm font-medium">{conversation.messages_count}</p>
            </div>
            <div className="rounded-lg border border-muted p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
                <Hash className="h-3.5 w-3.5" /> Tokens
              </p>
              <p className="text-sm font-medium">{(conversation.usage?.total_tokens ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(conversation.usage?.prompt_tokens ?? 0).toLocaleString()} in /{' '}
                {(conversation.usage?.completion_tokens ?? 0).toLocaleString()} out
              </p>
              {conversation.usage?.orchestrator && conversation.usage?.specialist && (
                <div className="mt-2 border-t border-border/40 pt-2 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    Orchestrator: {conversation.usage.orchestrator.total_tokens.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Specialist: {conversation.usage.specialist.total_tokens.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-muted p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
                <Coins className="h-3.5 w-3.5" /> Cost
              </p>
              <p className="text-sm font-mono font-medium">
                {formatCost(conversation.usage?.total_cost ?? 0, {
                  showNGN,
                  exchangeRate,
                  decimals: 6,
                })}
              </p>
              {conversation.usage?.orchestrator && conversation.usage?.specialist && (
                <div className="mt-2 border-t border-border/40 pt-2 space-y-0.5">
                  <p className="text-xs text-muted-foreground font-mono">
                    Orchestrator: {formatCost(conversation.usage.orchestrator.cost, { showNGN, exchangeRate, decimals: 4 })}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Specialist: {formatCost(conversation.usage.specialist.cost, { showNGN, exchangeRate, decimals: 4 })}
                  </p>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-muted p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="h-3.5 w-3.5" /> Created
              </p>
              <p className="text-sm font-medium">{format(new Date(conversation.created_at), 'PPp')}</p>
            </div>
          </div>
        </div>

        {/* Right Content - Message History (full height) */}
        <div className="flex-1 min-w-0">
          {conversation.messages.length === 0 ? (
            <div className="rounded-lg border py-8 text-center text-muted-foreground">
              No messages in this conversation
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <ChatContainerRoot className="max-h-[80vh] overflow-y-auto">
                <ChatContainerContent>
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
                </ChatContainerContent>
              </ChatContainerRoot>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
