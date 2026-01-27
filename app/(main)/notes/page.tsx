'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { X, Plus, TrendingUp, Clock } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  NoteCard,
  NoteListGroup,
  NotePagination,
  NoteListSkeleton,
  NoteEmptyState,
  NotesNavTabs,
} from '@/components/notes';
import { TrendingNoteCard, TrendingListSkeleton } from '@/components/trending';
import { PageContainer, PageHeader } from '@/components/layout';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotes } from '@/lib/hooks/useNotes';
import { useTrendingNotes } from '@/lib/hooks/useTrending';
import type { NoteListParams } from '@/types/note';

const librarySubTabs = [
  { value: 'trending', label: 'Trending', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'recent', label: 'Recently Added', icon: <Clock className="h-4 w-4" /> },
];

/**
 * Notes marketplace list page content (uses useSearchParams)
 */
function NotesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL state
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const tags = searchParams.get('tags') || '';
  const tab = searchParams.get('tab') || 'trending';

  // Sort for regular notes tab
  const sort = (searchParams.get('sort') as NoteListParams['sort']) || 'created_at';
  const order = (searchParams.get('order') as NoteListParams['order']) || 'desc';

  // Fetch regular notes (for "Recently Added" tab)
  const notesQuery = useNotes({
    page: tab === 'recent' ? page : 1,
    search: search || undefined,
    tags: tags || undefined,
    sort,
    order,
    per_page: 15,
  });

  // Fetch trending notes (for "Trending" tab)
  const trendingQuery = useTrendingNotes({
    page: tab === 'trending' ? page : 1,
    time_range: 'month',
    per_page: 15,
  });

  // Active query depends on tab
  const isTrendingTab = tab === 'trending';
  const activeQuery = isTrendingTab ? trendingQuery : notesQuery;

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | number | boolean | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === false) {
          params.delete(key);
        } else if (typeof value === 'boolean') {
          params.set(key, 'true');
        } else {
          params.set(key, String(value));
        }
      });
      const queryString = params.toString();
      router.push(queryString ? `/notes?${queryString}` : '/notes');
    },
    [router, searchParams]
  );

  // Handle search change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateParams({ search: e.target.value || null, page: null });
    },
    [updateParams]
  );

  // Handle clear tags filter
  const handleClearTags = useCallback(() => {
    updateParams({ tags: null, page: null });
  }, [updateParams]);

  // Handle page change
  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage > 1 ? newPage : null });
    },
    [updateParams]
  );

  // Handle sub-tab change
  const handleTabChange = useCallback(
    (value: string) => {
      updateParams({ tab: value === 'trending' ? null : value, page: null });
    },
    [updateParams]
  );

  // Check if any filters are active
  const hasActiveFilters = search || tags;

  // Render trending notes content
  const renderTrendingContent = () => {
    if (trendingQuery.isError) {
      return (
        <ErrorState
          title="Failed to load trending notes"
          description="We couldn't load trending notes. Please try again."
          retry={() => trendingQuery.refetch()}
        />
      );
    }

    if (!trendingQuery.data?.data || trendingQuery.data.data.length === 0) {
      return (
        <EmptyState
          icon={TrendingUp}
          title="No trending notes"
          description="Trending notes will appear here based on popularity and engagement."
        />
      );
    }

    return (
      <>
        <NoteListGroup>
          {trendingQuery.data.data.map((item, index) => (
            <TrendingNoteCard
              key={item.id}
              item={item}
              className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${index * 30}ms` }}
            />
          ))}
        </NoteListGroup>

        {trendingQuery.data.pagination.last_page > 1 && (
          <NotePagination
            currentPage={trendingQuery.data.pagination.current_page}
            lastPage={trendingQuery.data.pagination.last_page}
            total={trendingQuery.data.pagination.total}
            onPageChange={handlePageChange}
            className="mt-4"
          />
        )}
      </>
    );
  };

  // Render regular notes content
  const renderRecentContent = () => {
    if (notesQuery.isError) {
      return (
        <ErrorState
          title="Failed to load notes"
          description="We couldn't load the notes. Please try again."
          retry={() => notesQuery.refetch()}
        />
      );
    }

    if (!notesQuery.data?.data || notesQuery.data.data.length === 0) {
      if (hasActiveFilters) {
        return (
          <NoteEmptyState type="search" />
        );
      }
      return <NoteEmptyState type="browse" />;
    }

    return (
      <>
        <NoteListGroup>
          {notesQuery.data.data.map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${index * 30}ms` }}
            />
          ))}
        </NoteListGroup>

        {notesQuery.data.pagination.last_page > 1 && (
          <NotePagination
            currentPage={notesQuery.data.pagination.current_page}
            lastPage={notesQuery.data.pagination.last_page}
            total={notesQuery.data.pagination.total}
            onPageChange={handlePageChange}
            className="mt-4"
          />
        )}
      </>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Notes Library"
        description="Discover popular notes from the community"
      >
        <Button onClick={() => router.push('/notes/create')}>
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </PageHeader>

      {/* Main navigation tabs */}
      <NotesNavTabs activeTab="library" />

      {/* Full-width search bar (only for Recently Added tab) */}
      {!isTrendingTab && (
        <div className="relative">
          <Input
            type="text"
            placeholder="Search notes by title or content..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      )}

      {/* Sub-tabs: Trending / Recently Added + Active tag filter */}
      <div className="flex items-center gap-4">
        <AnimatedTabs
          tabs={librarySubTabs}
          value={tab}
          onValueChange={handleTabChange}
        />
        {/* Active tag filter (only for Recently Added tab) */}
        {!isTrendingTab && tags && (
          <button
            type="button"
            onClick={handleClearTags}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm text-primary transition-colors hover:bg-primary/20"
          >
            {tags}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      {activeQuery.isFetching ? (
        isTrendingTab ? <TrendingListSkeleton /> : <NoteListSkeleton />
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {isTrendingTab ? renderTrendingContent() : renderRecentContent()}
        </div>
      )}
    </PageContainer>
  );
}

/**
 * Notes marketplace list page with Suspense boundary for useSearchParams
 */
function NotesPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Notes Library"
            description="Discover popular notes from the community"
          />
          <Skeleton className="h-9 w-80 rounded-full" />
          <div className="flex justify-center">
            <Skeleton className="h-9 w-64 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <NoteListSkeleton />
        </PageContainer>
      }
    >
      <NotesPageContent />
    </Suspense>
  );
}

export default NotesPage;
