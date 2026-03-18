'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageSquare, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  MyConversationCard,
  ConversationListGroup,
  ConversationListSkeleton,
  ConversationSearchBar,
} from '@/components/conversations';
import { PageContainer, PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteConversations } from '@/lib/hooks/useConversations';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';

/**
 * Conversations list page content (uses useSearchParams)
 */
function ConversationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL state
  const search = searchParams.get('search') || '';

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();

  // Fetch conversations with infinite scroll
  const conversationsQuery = useInfiniteConversations({
    search: search || undefined,
    per_page: 15,
  });

  // Auto-fetch next page when sentinel is visible
  useEffect(() => {
    if (
      isIntersecting &&
      conversationsQuery.hasNextPage &&
      !conversationsQuery.isFetchingNextPage
    ) {
      conversationsQuery.fetchNextPage();
    }
  }, [
    isIntersecting,
    conversationsQuery.hasNextPage,
    conversationsQuery.isFetchingNextPage,
    conversationsQuery.fetchNextPage,
  ]);

  // Flatten pages data
  const items =
    conversationsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      const queryString = params.toString();
      router.push(
        queryString ? `/conversations?${queryString}` : '/conversations'
      );
    },
    [router, searchParams]
  );

  // Handle search change
  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ search: value || null });
    },
    [updateParams]
  );

  // Render list content
  const renderContent = () => {
    if (conversationsQuery.isError) {
      return (
        <ErrorState
          title="Failed to load conversations"
          description="We couldn't load your conversations. Please try again."
          retry={() => conversationsQuery.refetch()}
        />
      );
    }

    if (
      !conversationsQuery.data?.pages[0]?.data ||
      items.length === 0
    ) {
      return (
        <EmptyState
          icon={MessageSquare}
          title={search ? 'No conversations found' : 'No conversations yet'}
          description={
            search
              ? `No conversations match "${search}". Try a different search term.`
              : 'Start a new conversation to see it here.'
          }
          action={
            search
              ? {
                  label: 'Clear search',
                  onClick: () => updateParams({ search: null }),
                }
              : undefined
          }
        />
      );
    }

    return (
      <>
        <ConversationListGroup>
          {items.map((conversation, index) => (
            <MyConversationCard
              key={conversation.id}
              conversation={conversation}
              searchQuery={search || undefined}
              className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
              style={{
                animationDelay: `${Math.min(index, 14) * 30}ms`,
              }}
            />
          ))}
        </ConversationListGroup>

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {conversationsQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!conversationsQuery.hasNextPage && items.length > 0 && (
            <p className="text-sm text-muted-foreground">
              No more conversations
            </p>
          )}
        </div>
      </>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Conversations"
        description="Browse and search your AI conversations."
      />

      {/* Search bar */}
      <ConversationSearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Search conversations by title..."
        className="max-w-md"
      />

      {/* Content */}
      {conversationsQuery.isLoading ? (
        <ConversationListSkeleton />
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {renderContent()}
        </div>
      )}
    </PageContainer>
  );
}

/**
 * Conversations list page with Suspense boundary for useSearchParams
 */
function ConversationsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Conversations"
            description="Browse and search your AI conversations."
          />
          <Skeleton className="h-10 max-w-md" />
          <ConversationListSkeleton />
        </PageContainer>
      }
    >
      <ConversationsPageContent />
    </Suspense>
  );
}

export default ConversationsPage;
