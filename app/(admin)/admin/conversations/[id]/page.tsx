'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
import {
  ArrowLeft,
  Lock,
  Globe,
  MessageSquare,
  Calendar,
  Bot,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import type { AdminMessage } from '@/types/admin';
import type { ConversationMessage, ToolMessage } from '@/types/chat';

// Convert AdminMessage to ConversationMessage for chat components
function convertAdminMessages(
  adminMessages: AdminMessage[]
): ConversationMessage[] {
  return adminMessages.map((msg) => {
    const base = {
      id: String(msg.id),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
    };

    if (msg.role === 'tool' && msg.metadata?.type === 'tool_result') {
      return {
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
      } as ToolMessage;
    }

    return base as ConversationMessage;
  });
}

// Type guard for tool messages
function isToolMessage(message: ConversationMessage): message is ToolMessage {
  return message.role === 'tool';
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
      if (currentToolGroup.length > 0) {
        groups.push({ type: 'tool-chain', messages: currentToolGroup });
        currentToolGroup = [];
      }
      groups.push({ type: 'single', message });
    }
  }

  if (currentToolGroup.length > 0) {
    groups.push({ type: 'tool-chain', messages: currentToolGroup });
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
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/conversations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Conversations
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Conversation not found
          </CardContent>
        </Card>
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
      {/* Back Button */}
      <Link href="/admin/conversations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>
      </Link>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">
                {conversation.title || 'Untitled Conversation'}
              </CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                ID: {conversation.id}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <User className="h-3 w-3" /> User UUID
              </p>
              <p className="font-mono text-xs break-all">
                {conversation.user_uuid}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Bot className="h-3 w-3" /> Agent
              </p>
              <p>{conversation.agent?.name || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Messages
              </p>
              <p>{conversation.messages_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>{format(new Date(conversation.created_at), 'PPp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Messages - using same components as /c/{id} */}
      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>
            {conversation.messages.length} messages in chronological order
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {conversation.messages.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No messages in this conversation
            </p>
          ) : (
            <ChatContainerRoot className="max-h-[60vh] overflow-y-auto">
              <ChatContainerContent>
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
              </ChatContainerContent>
            </ChatContainerRoot>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
