'use client';

import { useEffect, type ReactNode } from 'react';
import { MessageSquare, Loader2, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { cn, stripPastedTags, stripContextTags } from '@/lib/utils';
import { useInfiniteContentConversations } from '@/lib/hooks/useConversations';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import type { ConversationListItem } from '@/types/chat';

interface FloatingConversationListProps {
  contentType: 'case' | 'note' | 'statute';
  slug: string;
  /** Only fetch while the panel is open and showing this view. */
  enabled: boolean;
  onSelect: (conversationId: string) => void;
  /** Rendered in the body when the user has no conversations yet (preprompts). */
  emptyFallback?: ReactNode;
}

const CONTENT_NOUN: Record<FloatingConversationListProps['contentType'], string> = {
  case: 'case',
  note: 'note',
  statute: 'statute',
};

function formatRelativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

function ConversationRow({
  conversation,
  onSelect,
}: {
  conversation: ConversationListItem;
  onSelect: (id: string) => void;
}) {
  const { id, title, status, first_message, last_message, updated_at } = conversation;
  // Row identity: the user's first question (backend already strips it). Falls
  // back to the conversation title when absent or a slug-only empty preview.
  const firstPreview = first_message?.preview?.trim() ?? '';
  const titleText = firstPreview || stripContextTags(stripPastedTags(title));
  const preview = last_message
    ? stripContextTags(stripPastedTags(last_message.preview))
    : '';
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        'group flex w-full flex-col gap-1 px-4 py-3 text-left',
        'transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-primary">
          {titleText}
        </h3>
        {status === 'archived' && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Archived
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {preview ? (
          <span className="min-w-0 flex-1 truncate">
            {last_message?.role === 'user' && (
              <span className="text-foreground/70">You: </span>
            )}
            {preview}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate italic opacity-70">No messages yet</span>
        )}
        <span aria-hidden>·</span>
        <span className="shrink-0 tabular-nums">
          {formatRelativeTime(last_message?.created_at ?? updated_at)}
        </span>
      </div>
    </button>
  );
}

/**
 * "Related conversations" view for the floating chat panel: lists the user's
 * prior conversations about the current case / note / statute. Selecting one
 * resumes it; "New chat" starts a fresh thread.
 */
export function FloatingConversationList({
  contentType,
  slug,
  enabled,
  onSelect,
  emptyFallback,
}: FloatingConversationListProps) {
  const query = useInfiniteContentConversations(
    contentType,
    slug,
    { per_page: 15 },
    { enabled },
  );

  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Auto-load the next page when the sentinel scrolls into view.
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const noun = CONTENT_NOUN[contentType];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {query.isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 px-4 py-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <ErrorState
              title="Couldn't load chats"
              description={`We couldn't load your conversations about this ${noun}. Please try again.`}
              retry={() => query.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          emptyFallback ?? (
            <div className="p-4">
              <EmptyState
                icon={MessageSquare}
                title="No chats yet"
                description={`Start a new chat to ask questions about this ${noun}.`}
              />
            </div>
          )
        ) : (
          <>
            <div className="divide-y divide-border">
              {items.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  onSelect={onSelect}
                />
              ))}
            </div>

            {/* Infinite-scroll sentinel + manual fallback */}
            <div ref={loadMoreRef} className="flex justify-center px-4 py-3">
              {isFetchingNextPage ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : hasNextPage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  className="text-muted-foreground"
                >
                  Load more
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">No more chats</p>
              )}
            </div>
          </>
        )}
    </div>
  );
}
