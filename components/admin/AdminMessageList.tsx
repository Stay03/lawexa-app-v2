'use client';

import { Message, MessageContent } from '@/components/prompt-kit/message';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, User, Bot, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import type { AdminMessage } from '@/types/admin';

interface AdminMessageListProps {
  messages: AdminMessage[];
}

function ToolMessage({ message }: { message: AdminMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const toolName = message.metadata?.tool_name || 'Tool';
  const isToolCall = message.metadata?.type === 'tool_call';
  const isSuccess = message.metadata?.success !== false;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            isSuccess ? 'bg-green-500' : 'bg-red-500'
          )}
        />
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{toolName}</span>
        {isToolCall && (
          <Badge variant="outline" className="text-xs">
            Call
          </Badge>
        )}
        {!isToolCall && (
          <Badge
            variant={isSuccess ? 'default' : 'destructive'}
            className="text-xs"
          >
            {isSuccess ? 'Success' : 'Failed'}
          </Badge>
        )}
        {message.metadata?.latency_ms && (
          <span className="text-xs text-muted-foreground ml-auto mr-2">
            {message.metadata.latency_ms}ms
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 pr-2 pb-2">
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
            {message.content}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AdminMessageList({ messages }: AdminMessageListProps) {
  const renderMessage = (message: AdminMessage) => {
    const isUser = message.role === 'user';
    const isTool = message.role === 'tool';
    const isToolCall = message.metadata?.type === 'tool_call';

    // Tool messages: show in collapsible style
    if (isTool || isToolCall) {
      return (
        <div key={message.id} className="py-1">
          <ToolMessage message={message} />
        </div>
      );
    }

    // User and Assistant messages
    return (
      <div
        key={message.id}
        className={cn('py-3', isUser && 'flex justify-end')}
      >
        <div className={cn('max-w-[85%]', isUser && 'text-right')}>
          <div
            className={cn(
              'flex items-center gap-2 mb-1',
              isUser && 'justify-end'
            )}
          >
            {isUser ? (
              <User className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Bot className="h-4 w-4 text-primary" />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          <Card className={cn(isUser && 'bg-primary/5')}>
            <CardContent className="p-3">
              <Message role={isUser ? 'user' : 'assistant'}>
                <MessageContent markdown={!isUser}>
                  {message.content}
                </MessageContent>
              </Message>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1 divide-y divide-border/30">
      {messages.map((message) => renderMessage(message))}
    </div>
  );
}
