'use client';

import Link from 'next/link';
import { ChevronRight, MessageSquare, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ConversationListItem } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

interface MyConversationCardProps {
  conversation: ConversationListItem;
  className?: string;
  style?: React.CSSProperties;
  searchQuery?: string;
}

function formatRelativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

/**
 * Conversation list item for the user's own conversations
 */
function MyConversationCard({
  conversation,
  className,
  style,
}: MyConversationCardProps) {
  const { id, title, agent, status, messages_count, updated_at } = conversation;

  return (
    <Link
      href={`/c/${id}`}
      className={cn(
        'group flex flex-col gap-2',
        'px-5 py-4',
        'transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
      style={style}
    >
      {/* Header: Title and metadata */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h3 className="min-w-0 flex-1 text-[20px] font-medium text-foreground group-hover:text-primary sm:truncate">
          {title}
        </h3>

        <div className="flex shrink-0 items-center gap-2.5 text-[16px] text-muted-foreground">
          {status === 'archived' && (
            <Badge variant="secondary" className="text-xs">
              Archived
            </Badge>
          )}
          <span className="tabular-nums">{formatRelativeTime(updated_at)}</span>
          <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
      </div>

      {/* Agent and message count */}
      <div className="flex items-center gap-3 text-[16px] text-muted-foreground">
        {agent && (
          <span className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            <span className="truncate">{agent.name}</span>
          </span>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="flex shrink-0 items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {messages_count} {messages_count === 1 ? 'message' : 'messages'}
        </span>
      </div>
    </Link>
  );
}

export { MyConversationCard };
