'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Plus, FolderOpen, Globe } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  FolderCard,
  FolderListGroup,
  FolderListSkeleton,
  FolderPagination,
  CreateFolderDialog,
} from '@/components/folders';
import { PageContainer, PageHeader } from '@/components/layout';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFolders, useMyFolders } from '@/lib/hooks/useFolders';

/******************************************************************************
                               Constants
******************************************************************************/

const FOLDER_TABS = [
  { value: 'my-folders', label: 'My Folders', icon: <FolderOpen className="h-4 w-4" /> },
  { value: 'explore', label: 'Explore', icon: <Globe className="h-4 w-4" /> },
];

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Folders page content (uses useSearchParams).
 */
function FoldersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Read URL state
  const tab = searchParams.get('tab') || 'my-folders';
  const urlSearch = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;

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
      router.push(queryString ? `/folders?${queryString}` : '/folders');
    },
    [router, searchParams]
  );

  // Local search state to avoid cursor jumping
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchInput, 300);
  const isInternalUpdate = useRef(false);

  // Sync debounced local state → URL
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      isInternalUpdate.current = true;
      updateParams({ search: debouncedSearch || null, page: null });
    }
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL → local state (for external changes like tab switch)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // Fetch folders based on active tab
  const search = debouncedSearch || undefined;
  const myFoldersQuery = useMyFolders({
    page,
    search,
    per_page: 15,
  });
  const exploreFoldersQuery = useFolders({
    page,
    search,
    per_page: 15,
  });
  const isMyFolders = tab === 'my-folders';
  const activeQuery = isMyFolders ? myFoldersQuery : exploreFoldersQuery;

  // Handlers
  const handleTabChange = useCallback(
    (value: string) => {
      setSearchInput('');
      updateParams({ tab: value === 'my-folders' ? null : value, page: null, search: null });
    },
    [updateParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage > 1 ? newPage : null });
    },
    [updateParams]
  );

  // Render content
  const renderContent = () => {
    if (activeQuery.isError) {
      return (
        <ErrorState
          title="Failed to load folders"
          description="We couldn't load your folders. Please try again."
          retry={() => activeQuery.refetch()}
        />
      );
    }
    if (!activeQuery.data?.data || activeQuery.data.data.length === 0) {
      if (search) {
        return (
          <EmptyState
            icon={FolderOpen}
            title="No folders found"
            description="Try a different search term."
          />
        );
      }
      if (isMyFolders) {
        return (
          <EmptyState
            icon={FolderOpen}
            title="No folders yet"
            description="Create your first folder to start organizing your content."
            action={{
              label: 'Create Folder',
              onClick: () => setIsCreateOpen(true),
            }}
          />
        );
      }
      return (
        <EmptyState
          icon={Globe}
          title="No public folders"
          description="No public folders have been shared yet."
        />
      );
    }
    return (
      <>
        <FolderListGroup>
          {activeQuery.data.data.map((folder, index) => (
            <FolderCard
              key={folder.uuid}
              folder={folder}
              className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
              style={{ animationDelay: `${index * 30}ms` }}
            />
          ))}
        </FolderListGroup>

        {activeQuery.data.pagination.last_page > 1 && (
          <FolderPagination
            currentPage={activeQuery.data.pagination.current_page}
            lastPage={activeQuery.data.pagination.last_page}
            total={activeQuery.data.pagination.total}
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
        title="Folders"
        description="Organize your cases, notes, and conversations into folders."
      >
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
      </PageHeader>

      {/* Tabs */}
      <AnimatedTabs
        tabs={FOLDER_TABS}
        value={tab}
        onValueChange={handleTabChange}
      />

      {/* Search */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search folders..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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

      {/* Stats */}
      {activeQuery.data && !activeQuery.isFetching && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {activeQuery.data.pagination.total} {activeQuery.data.pagination.total === 1 ? 'folder' : 'folders'}
          </span>
        </div>
      )}

      {/* Content */}
      {activeQuery.isFetching ? (
        <FolderListSkeleton />
      ) : (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {renderContent()}
        </div>
      )}

      {/* Create dialog */}
      <CreateFolderDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </PageContainer>
  );
}

/**
 * Default component. Folders page with Suspense boundary.
 */
function FoldersPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Folders"
            description="Organize your cases, notes, and conversations into folders."
          />
          <Skeleton className="h-9 w-64 rounded-full" />
          <Skeleton className="h-10 w-full" />
          <FolderListSkeleton />
        </PageContainer>
      }
    >
      <FoldersPageContent />
    </Suspense>
  );
}

export default FoldersPage;
