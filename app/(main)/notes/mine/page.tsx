'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Globe, FileEdit } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import {
  NoteCard,
  NoteListGroup,
  NotePagination,
  NoteListSkeleton,
  NoteEmptyState,
  NotesNavTabs,
} from '@/components/notes';
import { PageContainer, PageHeader } from '@/components/layout';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMyNotes } from '@/lib/hooks/useNotes';
import type { MyNotesParams, NoteStatus } from '@/types/note';

const myNotesSubTabs = [
  { value: 'published', label: 'Published', icon: <Globe className="h-4 w-4" /> },
  { value: 'draft', label: 'Drafts', icon: <FileEdit className="h-4 w-4" /> },
];

/**
 * My Notes list page content (uses useSearchParams)
 */
function MyNotesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL state
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const tab = searchParams.get('tab') || 'published';
  const status = tab as NoteStatus;
  const sort = (searchParams.get('sort') as MyNotesParams['sort']) || 'created_at';
  const order = (searchParams.get('order') as MyNotesParams['order']) || 'desc';

  // Fetch user's notes
  const { data, isFetching, isError, refetch } = useMyNotes({
    page,
    search: search || undefined,
    status: status || undefined,
    sort,
    order,
    per_page: 15,
  });

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
      router.push(queryString ? `/notes/mine?${queryString}` : '/notes/mine');
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

  // Handle sub-tab change
  const handleTabChange = useCallback(
    (value: string) => {
      updateParams({ tab: value === 'published' ? null : value, page: null });
    },
    [updateParams]
  );

  // Handle page change
  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage > 1 ? newPage : null });
    },
    [updateParams]
  );

  // Check if any filters are active
  const hasActiveFilters = search;

  // Render note list content
  const renderContent = () => {
    if (isError) {
      return (
        <ErrorState
          title="Failed to load notes"
          description="We couldn't load your notes. Please try again."
          retry={() => refetch()}
        />
      );
    }

    if (!data?.data || data.data.length === 0) {
      if (hasActiveFilters) {
        return (
          <NoteEmptyState type="search" />
        );
      }
      return <NoteEmptyState type="my-notes" />;
    }

    return (
      <>
        <NoteListGroup>
          {data.data.map((note, index) => (
            <NoteCard
              key={note.id}
              note={note}
              showStatus
              showPrivacy
              className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${index * 30}ms` }}
            />
          ))}
        </NoteListGroup>

        {data.pagination.last_page > 1 && (
          <NotePagination
            currentPage={data.pagination.current_page}
            lastPage={data.pagination.last_page}
            total={data.pagination.total}
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
        title="My Notes"
        description="Manage your notes, drafts, and published content."
      >
        <Button onClick={() => router.push('/notes/create')}>
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </PageHeader>

      {/* Main navigation tabs */}
      <NotesNavTabs activeTab="mine" />

      {/* Full-width search bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search your notes..."
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

      {/* Sub-tabs: Published / Drafts + Stats */}
      <div className="flex items-center gap-4">
        <AnimatedTabs
          tabs={myNotesSubTabs}
          value={tab}
          onValueChange={handleTabChange}
        />
        {/* Stats */}
        {data && !isFetching && (
          <span className="text-sm text-muted-foreground">
            {data.pagination.total} notes
          </span>
        )}
      </div>

      {/* Content */}
      {isFetching ? (
        <NoteListSkeleton />
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {renderContent()}
        </div>
      )}
    </PageContainer>
  );
}

/**
 * My Notes list page with Suspense boundary for useSearchParams
 */
function MyNotesPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="My Notes"
            description="Manage your notes, drafts, and published content."
          />
          <Skeleton className="h-9 w-80 rounded-full" />
          <div className="flex justify-center">
            <Skeleton className="h-9 w-52 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <NoteListSkeleton />
        </PageContainer>
      }
    >
      <MyNotesPageContent />
    </Suspense>
  );
}

export default MyNotesPage;
