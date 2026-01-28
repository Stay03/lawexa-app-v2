'use client';

import { Suspense, useCallback, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Scale, BookOpen, X, TrendingUp, Loader2 } from 'lucide-react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  CaseCard,
  CaseListGroup,
  CaseSearchBar,
  CaseListSkeleton,
} from '@/components/cases';
import { TrendingCaseCard, TrendingListSkeleton } from '@/components/trending';
import { PageContainer, PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteCases } from '@/lib/hooks/useCases';
import { useInfiniteTrendingCases } from '@/lib/hooks/useTrending';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { getTrendingLabel } from '@/types/trending';

/**
 * Case Library list page content (uses useSearchParams)
 */
function CasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('recent');

  // Read URL state (no page param needed for infinite scroll)
  const search = searchParams.get('search') || '';
  const tags = searchParams.get('tags') || '';

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();

  // Fetch cases with infinite scroll
  const casesQuery = useInfiniteCases({
    search: search || undefined,
    tags: tags || undefined,
    per_page: 15,
  });

  // Fetch trending cases with infinite scroll
  const trendingCases = useInfiniteTrendingCases({ per_page: 15, time_range: 'month' });

  // Active query depends on tab
  const activeQuery = activeTab === 'trending' ? trendingCases : casesQuery;

  // Auto-fetch next page when sentinel is visible
  useEffect(() => {
    if (isIntersecting && activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
      activeQuery.fetchNextPage();
    }
  }, [isIntersecting, activeQuery.hasNextPage, activeQuery.isFetchingNextPage, activeQuery.fetchNextPage]);

  // Dynamic trending tab label from API meta (e.g. "Trending in Ghana")
  const trendingLabel = getTrendingLabel(trendingCases.data?.pages[0]?.meta?.filters_applied);

  // Flatten pages data
  const caseItems = casesQuery.data?.pages.flatMap(page => page.data) ?? [];
  const trendingItems = trendingCases.data?.pages.flatMap(page => page.data) ?? [];

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
      router.push(queryString ? `/cases?${queryString}` : '/cases');
    },
    [router, searchParams]
  );

  // Handle search change
  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ search: value || null, tags: null });
    },
    [updateParams]
  );

  // Handle clear tags filter
  const handleClearTags = useCallback(() => {
    updateParams({ tags: null });
  }, [updateParams]);

  // Render case list content (loading state handled by parent)
  const renderContent = () => {
    if (casesQuery.isError) {
      return (
        <ErrorState
          title="Failed to load cases"
          description="We couldn't load the case library. Please try again."
          retry={() => casesQuery.refetch()}
        />
      );
    }

    if (!casesQuery.data?.pages[0]?.data || caseItems.length === 0) {
      const hasFilter = search || tags;
      return (
        <EmptyState
          icon={Scale}
          title={hasFilter ? 'No cases found' : 'No cases yet'}
          description={
            tags
              ? `No cases found with tag "${tags}".`
              : search
                ? `No cases match "${search}". Try a different search term.`
                : 'Cases will appear here once added to the library.'
          }
          action={
            hasFilter
              ? { label: 'Clear filters', onClick: () => updateParams({ search: null, tags: null }) }
              : undefined
          }
        />
      );
    }

    return (
      <>
        <CaseListGroup>
          {caseItems.map((caseItem, index) => (
            <CaseCard
              key={caseItem.id}
              caseItem={caseItem}
              className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
              style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
            />
          ))}
        </CaseListGroup>

        {/* Infinite scroll sentinel and loading indicator */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {casesQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!casesQuery.hasNextPage && caseItems.length > 0 && (
            <p className="text-sm text-muted-foreground">No more cases</p>
          )}
        </div>
      </>
    );
  };

  // Render trending cases content
  const renderTrendingContent = () => {
    if (trendingCases.isError) {
      return (
        <ErrorState
          title="Failed to load trending cases"
          description="We couldn't load trending cases. Please try again."
          retry={() => trendingCases.refetch()}
        />
      );
    }

    if (!trendingCases.data?.pages[0]?.data || trendingItems.length === 0) {
      return (
        <EmptyState
          icon={TrendingUp}
          title="No trending cases"
          description="Trending cases will appear here based on popularity and engagement."
        />
      );
    }

    return (
      <>
        <CaseListGroup>
          {trendingItems.map((item, index) => (
            <TrendingCaseCard
              key={item.id}
              item={item}
              className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
              style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
            />
          ))}
        </CaseListGroup>

        {/* Infinite scroll sentinel and loading indicator */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {trendingCases.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!trendingCases.hasNextPage && trendingItems.length > 0 && (
            <p className="text-sm text-muted-foreground">No more cases</p>
          )}
        </div>
      </>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Case Library"
        description="Browse and search legal cases from our comprehensive database."
      />

      {/* Search bar */}
      <CaseSearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Search cases by title..."
        className="max-w-md"
      />

      {/* Active tag filter */}
      {tags && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtering by tag:</span>
          <button
            type="button"
            onClick={handleClearTags}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm text-primary transition-colors hover:bg-primary/20"
          >
            {tags}
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tabs - show skeleton until data is ready */}
      {activeQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-48 rounded-full" />
          <CaseListSkeleton />
        </div>
      ) : (
        <>
          <AnimatedTabs
            tabs={[
              {
                value: 'recent',
                label: 'Recent Cases',
                icon: <BookOpen className="h-4 w-4" />,
              },
              {
                value: 'trending',
                label: trendingLabel,
                icon: <TrendingUp className="h-4 w-4" />,
              },
            ]}
            value={activeTab}
            onValueChange={setActiveTab}
            className="animate-in slide-in-from-top-2 duration-300"
          />

          {activeTab === 'recent' && (
            <div className="mt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              {renderContent()}
            </div>
          )}

          {activeTab === 'trending' && (
            <div className="mt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              {trendingCases.isLoading ? (
                <TrendingListSkeleton />
              ) : (
                renderTrendingContent()
              )}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

/**
 * Case Library list page with Suspense boundary for useSearchParams
 */
function CasesPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Case Library"
            description="Browse and search legal cases from our comprehensive database."
          />
          <Skeleton className="h-10 max-w-md" />
          <div className="space-y-4">
            <Skeleton className="h-9 w-48 rounded-full" />
            <CaseListSkeleton />
          </div>
        </PageContainer>
      }
    >
      <CasesPageContent />
    </Suspense>
  );
}

export default CasesPage;
