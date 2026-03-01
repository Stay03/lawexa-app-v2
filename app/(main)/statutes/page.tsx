'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BookOpen, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  StatuteCard,
  StatuteListGroup,
  StatuteListSkeleton,
} from '@/components/statutes';
import { CaseSearchBar } from '@/components/cases';
import { PageContainer, PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteStatutes } from '@/lib/hooks/useStatutes';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';

/**
 * Statute Library list page content (uses useSearchParams)
 */
function StatutesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL state
  const search = searchParams.get('search') || '';

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();

  // Fetch statutes with infinite scroll
  const statutesQuery = useInfiniteStatutes({
    search: search || undefined,
    per_page: 15,
  });

  // Auto-fetch next page when sentinel is visible
  useEffect(() => {
    if (isIntersecting && statutesQuery.hasNextPage && !statutesQuery.isFetchingNextPage) {
      statutesQuery.fetchNextPage();
    }
  }, [isIntersecting, statutesQuery.hasNextPage, statutesQuery.isFetchingNextPage, statutesQuery.fetchNextPage]);

  // Flatten pages data
  const statuteItems = statutesQuery.data?.pages.flatMap(page => page.data) ?? [];

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
      router.push(queryString ? `/statutes?${queryString}` : '/statutes');
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
    if (statutesQuery.isError) {
      return (
        <ErrorState
          title="Failed to load statutes"
          description="We couldn't load the statute library. Please try again."
          retry={() => statutesQuery.refetch()}
        />
      );
    }

    if (!statutesQuery.data?.pages[0]?.data || statuteItems.length === 0) {
      return (
        <EmptyState
          icon={BookOpen}
          title={search ? 'No statutes found' : 'No statutes yet'}
          description={
            search
              ? `No statutes match "${search}". Try a different search term.`
              : 'Statutes will appear here once added to the library.'
          }
          action={
            search
              ? { label: 'Clear search', onClick: () => updateParams({ search: null }) }
              : undefined
          }
        />
      );
    }

    return (
      <>
        <StatuteListGroup>
          {statuteItems.map((statute, index) => (
            <StatuteCard
              key={statute.id}
              statute={statute}
              searchQuery={search || undefined}
              className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
              style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
            />
          ))}
        </StatuteListGroup>

        {/* Infinite scroll sentinel and loading indicator */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {statutesQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!statutesQuery.hasNextPage && statuteItems.length > 0 && (
            <p className="text-sm text-muted-foreground">No more statutes</p>
          )}
        </div>
      </>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Statutes"
        description="Browse and search statutes, acts, and constitutions."
      />

      {/* Search bar */}
      <CaseSearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Search statutes by title..."
        className="max-w-md"
      />

      {/* List content */}
      {statutesQuery.isLoading ? (
        <StatuteListSkeleton />
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {renderContent()}
        </div>
      )}
    </PageContainer>
  );
}

/**
 * Statute Library list page with Suspense boundary for useSearchParams
 */
function StatutesPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Statutes"
            description="Browse and search statutes, acts, and constitutions."
          />
          <Skeleton className="h-10 max-w-md" />
          <StatuteListSkeleton />
        </PageContainer>
      }
    >
      <StatutesPageContent />
    </Suspense>
  );
}

export default StatutesPage;
