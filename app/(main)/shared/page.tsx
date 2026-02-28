'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TrendingUp, Clock, Loader2, MessageSquare } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import {
  ConversationCard,
  TrendingConversationCard,
  ConversationListGroup,
  ConversationListSkeleton,
  ConversationEmptyState,
} from '@/components/conversations';
import { PageContainer, PageHeader } from '@/components/layout';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useInfiniteSharedConversations,
  useInfiniteTrendingConversations,
} from '@/lib/hooks/useConversationSharing';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { useGuestAuth } from '@/lib/hooks/useGuestAuth';

const recentTab = { value: 'recent', label: 'Recently Shared', icon: <Clock className="h-4 w-4" /> };
const trendingTab = { value: 'trending', label: 'Trending', icon: <TrendingUp className="h-4 w-4" /> };
const tabs = [recentTab, trendingTab];

/**
 * Shared conversations browse page content
 */
function SharedConversationsPageContent() {
  // Guest auth — acquire token if user is unauthenticated
  const { isReady, isLoading: isGuestLoading, error: guestError } = useGuestAuth();

  const router = useRouter();
  const searchParams = useSearchParams();

  // Read tab from URL
  const tab = searchParams.get('tab') || 'recent';
  const isTrendingTab = tab === 'trending';

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();

  // Fetch shared conversations with infinite scroll (for "Recently Shared" tab)
  const sharedQuery = useInfiniteSharedConversations({
    sort_by: 'created_at',
    sort_order: 'desc',
    per_page: 15,
  });

  // Fetch trending conversations with infinite scroll (for "Trending" tab)
  const trendingQuery = useInfiniteTrendingConversations({
    time_range: 'month',
    per_page: 15,
  });

  // Active query depends on tab
  const activeQuery = isTrendingTab ? trendingQuery : sharedQuery;

  // Auto-fetch next page when sentinel is visible
  useEffect(() => {
    if (isIntersecting && activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
      activeQuery.fetchNextPage();
    }
  }, [isIntersecting, activeQuery.hasNextPage, activeQuery.isFetchingNextPage, activeQuery.fetchNextPage]);

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'recent') {
        params.delete('tab');
      } else {
        params.set('tab', value);
      }
      const queryString = params.toString();
      router.push(queryString ? `/shared?${queryString}` : '/shared');
    },
    [router, searchParams]
  );

  // Flatten pages data
  const sharedItems = sharedQuery.data?.pages.flatMap(page => page.data) ?? [];
  const trendingItems = trendingQuery.data?.pages.flatMap(page => page.data) ?? [];

  // Render trending conversations content
  const renderTrendingContent = () => {
    if (trendingQuery.isError) {
      return (
        <ErrorState
          title="Failed to load trending conversations"
          description="We couldn't load trending conversations. Please try again."
          retry={() => trendingQuery.refetch()}
        />
      );
    }

    if (!trendingQuery.data?.pages[0]?.data || trendingItems.length === 0) {
      return <ConversationEmptyState type="trending" />;
    }

    return (
      <>
        <ConversationListGroup>
          {trendingItems.map((conversation, index) => (
            <TrendingConversationCard
              key={conversation.id}
              conversation={conversation}
              className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
            />
          ))}
        </ConversationListGroup>

        {/* Infinite scroll sentinel and loading indicator */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {trendingQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!trendingQuery.hasNextPage && trendingItems.length > 0 && (
            <p className="text-sm text-muted-foreground">No more conversations</p>
          )}
        </div>
      </>
    );
  };

  // Render recently shared conversations content
  const renderRecentContent = () => {
    if (sharedQuery.isError) {
      return (
        <ErrorState
          title="Failed to load shared conversations"
          description="We couldn't load the shared conversations. Please try again."
          retry={() => sharedQuery.refetch()}
        />
      );
    }

    if (!sharedQuery.data?.pages[0]?.data || sharedItems.length === 0) {
      return <ConversationEmptyState type="browse" />;
    }

    return (
      <>
        <ConversationListGroup>
          {sharedItems.map((conversation, index) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
            />
          ))}
        </ConversationListGroup>

        {/* Infinite scroll sentinel and loading indicator */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {sharedQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!sharedQuery.hasNextPage && sharedItems.length > 0 && (
            <p className="text-sm text-muted-foreground">No more conversations</p>
          )}
        </div>
      </>
    );
  };

  // Wait for guest auth before rendering query-dependent content
  if (!isReady) {
    return (
      <PageContainer variant="list">
        <PageHeader
          title="Shared Conversations"
          description="Explore conversations shared by the community"
        />
        <ConversationListSkeleton />
      </PageContainer>
    );
  }
  // Guest auth error
  if (guestError) {
    return (
      <PageContainer variant="list">
        <PageHeader
          title="Shared Conversations"
          description="Explore conversations shared by the community"
        />
        <ErrorState
          title="Unable to load"
          description="We couldn't establish a connection. Please try refreshing the page."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Shared Conversations"
        description="Explore conversations shared by the community"
      />

      {/* Sub-tabs: Recently Shared / Trending */}
      <AnimatedTabs
        tabs={tabs}
        value={tab}
        onValueChange={handleTabChange}
      />

      {/* Content based on tab */}
      {activeQuery.isLoading ? (
        <ConversationListSkeleton />
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {isTrendingTab ? renderTrendingContent() : renderRecentContent()}
        </div>
      )}
    </PageContainer>
  );
}

export default function SharedConversationsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Shared Conversations"
            description="Explore conversations shared by the community"
          />
          <Skeleton className="h-9 w-64 rounded-full" />
          <ConversationListSkeleton />
        </PageContainer>
      }
    >
      <SharedConversationsPageContent />
    </Suspense>
  );
}
