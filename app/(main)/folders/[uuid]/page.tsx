'use client';

import { Suspense, useCallback, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
  Lock,
  Eye,
  FolderOpen,
} from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import {
  FolderCard,
  FolderListGroup,
  FolderListSkeleton,
  FolderPagination,
  FolderBreadcrumbs,
  FolderItemCard,
  CreateFolderDialog,
  EditFolderDialog,
  DeleteFolderDialog,
  AddItemToFolderDialog,
  getFolderIcon,
} from '@/components/folders';
import { PageContainer } from '@/components/layout';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFolder, useFolderItems } from '@/lib/hooks/useFolders';
import { useAuthStore } from '@/lib/stores/authStore';
import type { FolderItemType } from '@/types/folder';

/******************************************************************************
                               Constants
******************************************************************************/

const CONTENT_TYPE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'subfolder', label: 'Subfolders' },
  { value: 'case', label: 'Cases' },
  { value: 'note', label: 'Notes' },
  { value: 'conversation', label: 'Conversations' },
];

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Folder detail page content.
 */
function FolderDetailContent() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateSubfolderOpen, setIsCreateSubfolderOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  // URL state for items
  const itemPage = Number(searchParams.get('page')) || 1;
  const typeFilter = (searchParams.get('type') || 'all') as FolderItemType | 'all' | 'subfolder';

  // Fetch folder detail and items
  const folderQuery = useFolder(uuid);
  const showItems = typeFilter !== 'subfolder';
  const itemsQuery = useFolderItems(uuid, {
    page: itemPage,
    type: typeFilter === 'all' || typeFilter === 'subfolder' ? undefined : typeFilter,
    per_page: 15,
  });

  const folder = folderQuery.data?.data;
  const isOwner = folder && user ? folder.user.id === user.id : false;

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
      router.push(queryString ? `/folders/${uuid}?${queryString}` : `/folders/${uuid}`);
    },
    [router, searchParams, uuid]
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      updateParams({ type: value === 'all' ? null : value, page: null });
    },
    [updateParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage > 1 ? newPage : null });
    },
    [updateParams]
  );

  const handleDeleted = () => {
    router.push('/folders');
  };

  // Loading state
  if (folderQuery.isLoading) {
    return (
      <PageContainer variant="list">
        <Skeleton className="h-5 w-48" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <FolderListSkeleton count={3} />
      </PageContainer>
    );
  }

  // Error state
  if (folderQuery.isError || !folder) {
    return (
      <PageContainer variant="list">
        <ErrorState
          title="Folder not found"
          description="This folder doesn't exist or you don't have permission to view it."
          retry={() => folderQuery.refetch()}
        />
      </PageContainer>
    );
  }

  // Resolve icon component
  const Icon = getFolderIcon(folder.icon);

  return (
    <PageContainer variant="list">
      {/* Breadcrumbs */}
      <FolderBreadcrumbs folder={folder} />

      {/* Folder header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Colored folder icon */}
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: folder.color ? `${folder.color}18` : undefined,
              color: folder.color || undefined,
            }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{folder.name}</h1>
            {folder.description && (
              <p className="mt-1 text-muted-foreground">{folder.description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <BookmarkButton
            type="folder"
            id={folder.id}
            isBookmarked={folder.is_bookmarked}
            bookmarksCount={folder.bookmarks_count}
            variant="full"
          />
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{folder.children_count} {folder.children_count === 1 ? 'subfolder' : 'subfolders'}</span>
        <span className="text-border">|</span>
        <span>{folder.items_count} {folder.items_count === 1 ? 'item' : 'items'}</span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          {folder.views_count}
        </span>
        {folder.is_private && (
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" />
            Private
          </Badge>
        )}
      </div>

      {/* Contents heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contents</h2>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateSubfolderOpen(true)}
            >
              <FolderPlus className="mr-1 h-4 w-4" />
              New Subfolder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddItemOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Item
            </Button>
          </div>
        )}
      </div>

      {/* Content type filter */}
      <AnimatedTabs
        tabs={CONTENT_TYPE_TABS}
        value={typeFilter}
        onValueChange={handleTypeChange}
      />

      {/* Unified content list */}
      {showItems && itemsQuery.isFetching ? (
        <FolderListSkeleton count={3} />
      ) : showItems && itemsQuery.isError ? (
        <ErrorState
          title="Failed to load items"
          description="We couldn't load the folder contents. Please try again."
          retry={() => itemsQuery.refetch()}
        />
      ) : (() => {
        const subfolders = (typeFilter === 'all' || typeFilter === 'subfolder') ? folder.children : [];
        const items = showItems ? (itemsQuery.data?.data || []) : [];
        const hasContent = subfolders.length > 0 || items.length > 0;

        if (!hasContent) {
          return (
            <EmptyState
              icon={FolderOpen}
              title={typeFilter === 'subfolder' ? 'No subfolders' : typeFilter === 'all' ? 'No contents' : `No ${typeFilter}s`}
              description={
                isOwner
                  ? typeFilter === 'subfolder'
                    ? 'Create a subfolder to organize content within this folder.'
                    : 'Add cases, notes, or conversations to this folder.'
                  : 'This folder is empty.'
              }
              className="py-6"
            />
          );
        }

        return (
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <FolderListGroup>
              {/* Subfolders first (OS convention) */}
              {subfolders.map((child, index) => (
                <FolderCard
                  key={child.uuid}
                  folder={child}
                  className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
                  style={{ animationDelay: `${index * 30}ms` }}
                />
              ))}
              {/* Items after subfolders */}
              {items.map((item, index) => (
                <FolderItemCard
                  key={item.id}
                  item={item}
                  folderUuid={uuid}
                  isOwner={isOwner}
                  className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200"
                  style={{ animationDelay: `${(subfolders.length + index) * 30}ms` }}
                />
              ))}
            </FolderListGroup>

            {showItems && itemsQuery.data?.pagination && itemsQuery.data.pagination.last_page > 1 && (
              <FolderPagination
                currentPage={itemsQuery.data.pagination.current_page}
                lastPage={itemsQuery.data.pagination.last_page}
                total={itemsQuery.data.pagination.total}
                onPageChange={handlePageChange}
                className="mt-4"
              />
            )}
          </div>
        );
      })()}

      {/* Owner dialogs */}
      {isOwner && (
        <>
          <EditFolderDialog
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            folder={folder}
          />
          <DeleteFolderDialog
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            folder={folder}
            onDeleted={handleDeleted}
          />
          <CreateFolderDialog
            open={isCreateSubfolderOpen}
            onOpenChange={setIsCreateSubfolderOpen}
            parentId={folder.uuid}
          />
          <AddItemToFolderDialog
            open={isAddItemOpen}
            onOpenChange={setIsAddItemOpen}
            folderUuid={folder.uuid}
          />
        </>
      )}
    </PageContainer>
  );
}

/**
 * Default component. Folder detail page with Suspense boundary.
 */
function FolderDetailPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <Skeleton className="h-5 w-48" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <FolderListSkeleton count={3} />
        </PageContainer>
      }
    >
      <FolderDetailContent />
    </Suspense>
  );
}

export default FolderDetailPage;
