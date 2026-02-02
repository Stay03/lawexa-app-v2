'use client';

import Link from 'next/link';
import { MessageSquare, Eye, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SharedConversationItem } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

interface ConversationCardProps {
  conversation: SharedConversationItem;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Format relative time from ISO date string
 */
function formatRelativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

/**
 * Compact conversation list item for grouped display
 */
function ConversationCard({
  conversation,
  className,
  style,
}: ConversationCardProps) {
  const { id, title, author, messages_count, views_count, created_at, agent } = conversation;

  return (
    <Link
      href={`/c/${id}`}
      className={cn(
        'group flex gap-4',
        'px-5 py-4',
        'transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
      style={style}
    >
      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header: Title and metadata */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h3 className="min-w-0 flex-1 text-[20px] font-medium text-foreground group-hover:text-primary sm:truncate">
            {title}
          </h3>

          <div className="flex shrink-0 flex-wrap items-center gap-2 text-[16px] text-muted-foreground sm:flex-nowrap sm:gap-2.5">
            {/* Messages count */}
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {messages_count}
            </span>

            {/* Views count */}
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {views_count}
            </span>

            {/* Date */}
            <span className="tabular-nums">{formatRelativeTime(created_at)}</span>

            <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </div>

        {/* Author and Agent */}
        <div className="mt-1 flex items-center gap-3 text-[16px] text-muted-foreground">
          {/* Author */}
          <div className="flex items-center gap-1.5">
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {author.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span>{author.name}</span>
          </div>

          {/* Agent */}
          {agent && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground/80">{agent.name}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export { ConversationCard };
