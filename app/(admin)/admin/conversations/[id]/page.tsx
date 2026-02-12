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
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
} from '@/components/prompt-kit';
import { ToolCallDetails } from '@/components/chat/tool-call-details';
import { useAdminConversation } from '@/lib/hooks/useAdmin';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { formatCost } from '@/lib/utils/currency';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AdminMessage } from '@/types/admin';
import type { ConversationMessage, ToolMessage, HandoverMessage } from '@/types/chat';
import { isHandoverMessage } from '@/types/chat';

// Convert AdminMessage to ConversationMessage for chat components
function convertAdminMessages(
  adminMessages: AdminMessage[]
): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  // Build a map of handover_result messages by iteration
  const handoverResultsByIteration = new Map<number, AdminMessage>();
  adminMessages.forEach((msg) => {
    if (
      msg.role === 'assistant' &&
      msg.metadata?.type === 'handover_result' &&
      msg.metadata.iteration !== undefined
    ) {
      handoverResultsByIteration.set(msg.metadata.iteration, msg);
    }
  });

  for (const msg of adminMessages) {
    const base = {
      id: String(msg.id),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
    };

    // Handle handover messages - orchestrator delegating to sub-agent
    if (msg.role === 'assistant' && msg.metadata?.type === 'handover') {
      const iteration = msg.metadata.iteration;
      const handoverResult =
        iteration !== undefined
          ? handoverResultsByIteration.get(iteration)
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

    // Handle tool_result messages
    if (msg.role === 'tool' && msg.metadata?.type === 'tool_result') {
      messages.push({
        ...base,
        role: 'tool' as const,
        toolName: msg.metadata.tool_name || 'unknown',
        toolParameters: msg.metadata.tool_parameters || {},
        toolResult: {
          success: msg.metadata.success ?? true,
          data: null,
          error: null,
        },
        toolStatus: 'complete' as const,
        latencyMs: msg.metadata.latency_ms,
      } as ToolMessage);
      continue;
    }

    // Handle tool_call messages - these are assistant messages requesting tool use
    if (msg.metadata?.type === 'tool_call') {
      messages.push({
        ...base,
        role: 'tool' as const,
        toolName: msg.metadata.tool_name || 'unknown',
        toolParameters: msg.metadata.tool_parameters || {},
        toolResult: {
          success: true,
          data: null,
          error: null,
        },
        toolStatus: 'complete' as const,
        latencyMs: msg.metadata.latency_ms,
      } as ToolMessage);
      continue;
    }

    messages.push(base as ConversationMessage);
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

// Format tool name for display
function formatToolMessage(
  toolName: string,
  parameters: Record<string, unknown>
): { action: string; detail?: string } {
  const query = parameters.query as string | undefined;

  switch (toolName) {
    case 'search_cases':
      return {
        action: 'Searched cases',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'search_notes':
      return {
        action: 'Searched notes',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'get_case':
    case 'get_case_details':
      return {
        action: 'Retrieved case details',
        detail: parameters.case_id
          ? `for case #${parameters.case_id}`
          : undefined,
      };
    case 'get_note':
    case 'get_note_details':
      return {
        action: 'Retrieved note',
        detail: parameters.note_id ? `#${parameters.note_id}` : undefined,
      };
    default:
      const readable = toolName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { action: readable };
  }
}

// Format latency in seconds
function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
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

  return (
    <div className="px-4">
      <div className="mx-auto max-w-2xl">
        {/* Agent header */}
        <Collapsible open={isTaskExpanded} onOpenChange={setIsTaskExpanded}>
          <CollapsibleTrigger asChild>
            <div className="hover:bg-muted/50 -mx-1 mb-1 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 transition-colors">
              <div className="bg-primary/10 text-primary flex h-5 w-5 items-center justify-center rounded-full">
                <Bot className="h-3 w-3" />
              </div>
              <span className="text-sm font-medium">{agentName}</span>
              <div className="flex-1" />
              {handover.latencyMs && (
                <span className="text-muted-foreground text-xs">
                  completed {(handover.latencyMs / 1000).toFixed(1)}s
                </span>
              )}
              <ChevronDown
                className={cn(
                  'text-muted-foreground h-3.5 w-3.5 transition-transform duration-200',
                  isTaskExpanded && 'rotate-180'
                )}
              />
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
                const isSuccess = message.toolResult?.success;
                const isLast = index === toolMessages.length - 1;
                const isExpanded = expandedSteps.has(message.id);

                const status = isSuccess ? 'success' : 'error';

                const { action, detail } = formatToolMessage(
                  message.toolName,
                  message.toolParameters
                );

                return (
                  <ChainOfThoughtStep
                    key={message.id}
                    isLast={isLast}
                    status={status}
                  >
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleStep(message.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <ChainOfThoughtTrigger
                          isClickable={true}
                          isExpanded={isExpanded}
                          rightContent={
                            message.latencyMs
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

                    {!isSuccess && !isExpanded && (
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

        {/* Agent response - expandable section */}
        {handover.handoverResultContent && (
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
            const isSuccess = message.toolResult?.success;
            const isLast = index === messages.length - 1;
            const isExpanded = expandedSteps.has(message.id);

            const status = isSuccess ? 'success' : 'error';

            const { action, detail } = formatToolMessage(
              message.toolName,
              message.toolParameters
            );

            return (
              <ChainOfThoughtStep key={message.id} isLast={isLast} status={status}>
                <Collapsible
                  open={isExpanded}
                  onOpenChange={() => toggleStep(message.id)}
                >
                  <CollapsibleTrigger asChild>
                    <ChainOfThoughtTrigger
                      isClickable={true}
                      isExpanded={isExpanded}
                      rightContent={
                        message.latencyMs
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

                {!isSuccess && !isExpanded && (
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
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-28 mb-3" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 mt-1" />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 lg:shrink-0 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="flex-1 h-[70vh] rounded-lg" />
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

    // Strip XML tags from user message content if present
    let displayContent = message.content;
    if (message.role === 'user') {
      displayContent = message.content.replace(
        /<(case_slug|note_slug)>[^<]+<\/\1>\n\n/g,
        ''
      );
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
          <MessageContent className="bg-muted rounded-3xl px-5 py-2.5">
            {displayContent}
          </MessageContent>
        )}
      </Message>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link href="/admin/conversations">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Conversations
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {conversation.title || 'Untitled Conversation'}
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              {conversation.id}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
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
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - Stats */}
        <div className="lg:w-56 lg:shrink-0 space-y-3">
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
              <p className="text-sm font-medium">{conversation.usage.total_tokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {conversation.usage.prompt_tokens.toLocaleString()} in /{' '}
                {conversation.usage.completion_tokens.toLocaleString()} out
              </p>
            </div>
            <div className="rounded-lg border border-muted p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
                <Coins className="h-3.5 w-3.5" /> Cost
              </p>
              <p className="text-sm font-mono font-medium">
                {formatCost(conversation.usage.total_cost, {
                  showNGN,
                  exchangeRate,
                  decimals: 6,
                })}
              </p>
            </div>
            <div className="rounded-lg border border-muted p-3">
              <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="h-3.5 w-3.5" /> Created
              </p>
              <p className="text-sm font-medium">{format(new Date(conversation.created_at), 'PPp')}</p>
            </div>
          </div>
        </div>

        {/* Right Content - Message History */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Message History</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {conversation.messages.length} messages in chronological order
          </p>
          {conversation.messages.length === 0 ? (
            <div className="rounded-lg border py-8 text-center text-muted-foreground">
              No messages in this conversation
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <ChatContainerRoot className="max-h-[70vh] overflow-y-auto">
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
