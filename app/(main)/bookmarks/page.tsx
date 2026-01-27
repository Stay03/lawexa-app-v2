'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bookmark, Scale, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { PageContainer, PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useBookmarks } from '@/lib/hooks/useBookmarks';
import type {
  BookmarkType,
  Bookmark as BookmarkItem,
  BookmarkCaseContent,
  BookmarkNoteContent,
} from '@/types/bookmark';

/******************************************************************************
                               Constants
******************************************************************************/

const BOOKMARK_TABS = [
  { value: 'all', label: 'All', icon: <Bookmark className="h-4 w-4" /> },
  { value: 'case', label: 'Cases', icon: <Scale className="h-4 w-4" /> },
  { value: 'note', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
];

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Single bookmark item card (polymorphic — renders case or note content)
 */
function BookmarkCard({ bookmark, index }: { bookmark: BookmarkItem; index: number }) {
  const isCase = bookmark.type === 'case';
  const content = bookmark.content;
  const href = isCase ? `/cases/${content.slug}` : `/notes/${content.slug}`;

  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
            {isCase ? (
              <Scale className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <h3 className="min-w-0 truncate text-sm font-medium text-foreground group-hover:text-primary">
            {content.title}
          </h3>
        </div>
        {!isCase && 'content_preview' in content && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {(content as BookmarkNoteContent).content_preview}
          </p>
        )}
        {isCase && (content as BookmarkCaseContent).citation && (
          <p className="text-xs text-muted-foreground">
            {(content as BookmarkCaseContent).citation}
          </p>
        )}
      </div>
      <div onClick={(e) => e.preventDefault()} className="shrink-0">
        <BookmarkButton
          type={bookmark.type}
          id={content.id}
          isBookmarked={content.is_bookmarked}
          variant="icon"
        />
      </div>
    </Link>
  );
}

/**
 * Pagination controls for bookmarks
 */
function BookmarksPagination({
  currentPage,
  lastPage,
  total,
  onPageChange,
}: {
  currentPage: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? 'bookmark' : 'bookmarks'}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="px-2 text-sm text-muted-foreground">
          Page {currentPage} of {lastPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= lastPage}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Bookmarks page content (uses useSearchParams)
 */
function BookmarksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL state
  const page = Number(searchParams.get('page')) || 1;
  const tab = (searchParams.get('type') || 'all') as 'all' | BookmarkType;

  // Build API params
  const typeFilter = tab === 'all' ? undefined : tab;

  // Fetch bookmarks
  const { data, isFetching, isError, refetch } = useBookmarks({
    page,
    type: typeFilter,
    per_page: 15,
  });

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
      router.push(queryString ? `/bookmarks?${queryString}` : '/bookmarks');
    },
    [router, searchParams]
  );

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      updateParams({ type: value === 'all' ? null : value, page: null });
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

  // Render content
  const renderContent = () => {
    if (isError) {
      return (
        <ErrorState
          title="Failed to load bookmarks"
          description="We couldn't load your bookmarks. Please try again."
          retry={() => refetch()}
        />
      );
    }

    if (!data?.data || data.data.length === 0) {
      return (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description={
            tab !== 'all'
              ? `You haven't bookmarked any ${tab === 'case' ? 'cases' : 'notes'} yet.`
              : 'Start bookmarking cases and notes to save them for later.'
          }
          action={
            tab !== 'all'
              ? { label: 'View all bookmarks', onClick: () => handleTabChange('all') }
              : { label: 'Browse Cases', onClick: () => router.push('/cases') }
          }
        />
      );
    }

    return (
      <>
        <div className="divide-y divide-border overflow-hidden rounded-lg">
          {data.data.map((bookmark, index) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} index={index} />
          ))}
        </div>

        {data.pagination.last_page > 1 && (
          <BookmarksPagination
            currentPage={data.pagination.current_page}
            lastPage={data.pagination.last_page}
            total={data.pagination.total}
            onPageChange={handlePageChange}
          />
        )}
      </>
    );
  };

  return (
    <PageContainer variant="list">
      <PageHeader
        title="Bookmarks"
        description="Your saved cases and notes for quick access."
      />

      {/* Tabs and content */}
      {isFetching ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-64 rounded-full" />
          <div className="divide-y divide-border overflow-hidden rounded-lg">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <AnimatedTabs
            tabs={BOOKMARK_TABS}
            value={tab}
            onValueChange={handleTabChange}
            className="animate-in slide-in-from-top-2 duration-300"
          />

          <div className="mt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {renderContent()}
          </div>
        </>
      )}
    </PageContainer>
  );
}

/******************************************************************************
                               Page Export
******************************************************************************/

/**
 * Bookmarks page with Suspense boundary for useSearchParams
 */
function BookmarksPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Bookmarks"
            description="Your saved cases and notes for quick access."
          />
          <Skeleton className="h-9 w-64 rounded-full" />
          <div className="divide-y divide-border overflow-hidden rounded-lg">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 flex-1" />
              </div>
            ))}
          </div>
        </PageContainer>
      }
    >
      <BookmarksPageContent />
    </Suspense>
  );
}

export default BookmarksPage;
