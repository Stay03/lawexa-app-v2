'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileQuestion, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import { ContentRequestCard, ContentRequestDialog } from '@/components/content-requests';
import { useInfiniteContentRequests } from '@/lib/hooks/useContentRequests';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { useAuthStore } from '@/lib/stores/authStore';
import type { ContentRequestStatus } from '@/types/content-request';

/******************************************************************************
                               Constants
******************************************************************************/

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
] as const;

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Content Requests page content (uses useSearchParams)
 */
function ContentRequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const isGuest = user?.role === 'guest';

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Read tab from URL or default to 'all'
  const statusParam = searchParams.get('status') || 'all';
  const [activeTab, setActiveTab] = useState(statusParam);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();

  // Compute filter params — only pass status if not 'all'
  const filterStatus = activeTab !== 'all' ? (activeTab as ContentRequestStatus) : undefined;

  // Fetch content requests
  const requestsQuery = useInfiniteContentRequests({
    status: filterStatus,
    per_page: 15,
  });

  // Auto-fetch next page when sentinel is visible
  useEffect(() => {
    if (isIntersecting && requestsQuery.hasNextPage && !requestsQuery.isFetchingNextPage) {
      requestsQuery.fetchNextPage();
    }
  }, [isIntersecting, requestsQuery.hasNextPage, requestsQuery.isFetchingNextPage, requestsQuery.fetchNextPage]);

  // Flatten pages data
  const items = requestsQuery.data?.pages.flatMap(page => page.data) ?? [];

  // Handle tab change — update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams();
    if (value !== 'all') {
      params.set('status', value);
    }
    const queryString = params.toString();
    router.push(queryString ? `/content-requests?${queryString}` : '/content-requests');
  };

  // Render list content
  const renderContent = () => {
    if (requestsQuery.isError) {
      return (
        <ErrorState
          title="Failed to load requests"
          description="We couldn't load your content requests. Please try again."
          retry={() => requestsQuery.refetch()}
        />
      );
    }

    if (!requestsQuery.data?.pages[0]?.data || items.length === 0) {
      const hasFilter = activeTab !== 'all';
      return (
        <EmptyState
          icon={FileQuestion}
          title={hasFilter ? `No ${activeTab.replace('_', ' ')} requests` : 'No requests yet'}
          description={
            hasFilter
              ? `You don't have any ${activeTab.replace('_', ' ')} content requests.`
              : "Can't find the content you need? Submit a request and our research team will work on adding it."
          }
          action={
            hasFilter
              ? { label: 'View all requests', onClick: () => handleTabChange('all') }
              : !isGuest
                ? { label: 'Request Content', onClick: () => setIsDialogOpen(true) }
                : undefined
          }
        />
      );
    }

    return (
      <>
        <div className="divide-y divide-border overflow-hidden rounded-lg">
          {items.map((request, index) => (
            <ContentRequestCard
              key={request.uuid}
              request={request}
              className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
              style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
            />
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {requestsQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!requestsQuery.hasNextPage && items.length > 0 && (
            <p className="text-sm text-muted-foreground">No more requests</p>
          )}
        </div>
      </>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="My Requests"
        description="Track your content requests and their status."
      >
        {!isGuest && (
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Request
          </Button>
        )}
      </PageHeader>

      {/* Status filter tabs */}
      {requestsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-80 rounded-full" />
          <ContentRequestListSkeleton />
        </div>
      ) : (
        <>
          <AnimatedTabs
            tabs={STATUS_TABS.map(tab => ({ value: tab.value, label: tab.label }))}
            value={activeTab}
            onValueChange={handleTabChange}
            className="animate-in slide-in-from-top-2 duration-300"
          />

          <div className="mt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {renderContent()}
          </div>
        </>
      )}

      {/* Request dialog */}
      <ContentRequestDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </PageContainer>
  );
}

/**
 * Loading skeleton for the content request list
 */
function ContentRequestListSkeleton({ count = 5 }: { count?: number }) {
  const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];

  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-lg">
      {Array.from({ length: count }).map((_, i) => {
        const opacity = opacityValues[i] ?? 0.25;
        return (
          <div
            key={i}
            className="flex flex-col gap-2.5 px-5 py-4"
            style={{ opacity }}
          >
            {/* Title */}
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            {/* Badges row */}
            <div className="flex gap-2">
              <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
            {/* Notes preview */}
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Content Requests page with Suspense boundary
 */
function ContentRequestsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="My Requests"
            description="Track your content requests and their status."
          />
          <div className="space-y-4">
            <Skeleton className="h-9 w-80 rounded-full" />
            <ContentRequestListSkeleton />
          </div>
        </PageContainer>
      }
    >
      <ContentRequestsPageContent />
    </Suspense>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default ContentRequestsPage;
