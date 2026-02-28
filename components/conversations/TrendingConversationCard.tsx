'use client';

import Link from 'next/link';
import { Eye, TrendingUp, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TrendingConversationItem } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';

interface TrendingConversationCardProps {
  conversation: TrendingConversationItem;
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
 * Conversation card with trending score badge
 */
function TrendingConversationCard({
  conversation,
  className,
  style,
}: TrendingConversationCardProps) {
  const {
    id,
    title,
    author,
    views_count,
    trending_score,
    unique_viewers,
    created_at,
    agent,
  } = conversation;

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
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h3 className="min-w-0 flex-1 text-[20px] font-medium text-foreground group-hover:text-primary sm:truncate">
              {title}
            </h3>
            {/* Trending badge */}
            <Badge variant="secondary" className="shrink-0 gap-1">
              <TrendingUp className="h-3 w-3" />
              {Math.round(trending_score)}
            </Badge>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 text-[16px] text-muted-foreground">
            <span className="tabular-nums">{formatRelativeTime(created_at)}</span>
            <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </div>

        {/* Author, Agent, Views, and Unique Viewers */}
        <div className="mt-1 flex min-w-0 items-center gap-3 text-[16px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            {author.avatar_url ? (
              <img src={author.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {author.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">{author.name}</span>
          </div>
          {agent && (
            <span className="hidden shrink-0 items-center gap-3 sm:flex">
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground/80">{agent.name}</span>
            </span>
          )}
          <span className="shrink-0 text-muted-foreground/50">·</span>
          <span className="flex shrink-0 items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {views_count}
          </span>
          {unique_viewers > 0 && (
            <span className="hidden shrink-0 items-center gap-3 sm:flex">
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground/80">
                {unique_viewers} unique {unique_viewers === 1 ? 'viewer' : 'viewers'}
              </span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export { TrendingConversationCard };
