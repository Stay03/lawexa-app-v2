'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Files, Upload, ImageIcon, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import { FileCard, FileUploadDialog, FileDeleteDialog } from '@/components/files';
import {
  FileUpload,
  FileUploadContent,
} from '@/components/ui/file-upload';
import { useInfiniteFiles, useUploadImage, useUploadDocument } from '@/lib/hooks/useFiles';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import type { UserFile, FileCategory } from '@/types/file';
import { useDownloadFile } from '@/lib/hooks/useFiles';

/******************************************************************************
                               Constants
******************************************************************************/

const CATEGORY_TABS = [
  { value: 'all', label: 'All', icon: <Files className="h-3.5 w-3.5" /> },
  { value: 'content-image', label: 'Images', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: 'document', label: 'Documents', icon: <FileText className="h-3.5 w-3.5" /> },
] as const;

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

/******************************************************************************
                               Page Content
******************************************************************************/

function FilesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deleteFile, setDeleteFile] = useState<UserFile | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Read category tab from URL
  const categoryParam = searchParams.get('category') || 'all';
  const [activeTab, setActiveTab] = useState(categoryParam);

  // Infinite scroll
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver();

  // Filter params
  const filterCategory =
    activeTab !== 'all' ? (activeTab as FileCategory) : undefined;

  // Fetch files
  const filesQuery = useInfiniteFiles({
    category: filterCategory,
    per_page: 15,
  });

  // Upload mutations for drag-and-drop
  const uploadImageMutation = useUploadImage();
  const uploadDocumentMutation = useUploadDocument();

  // Download mutation
  const downloadMutation = useDownloadFile();

  // Auto-fetch next page
  useEffect(() => {
    if (
      isIntersecting &&
      filesQuery.hasNextPage &&
      !filesQuery.isFetchingNextPage
    ) {
      filesQuery.fetchNextPage();
    }
  }, [
    isIntersecting,
    filesQuery.hasNextPage,
    filesQuery.isFetchingNextPage,
    filesQuery.fetchNextPage,
  ]);

  // Flatten pages
  const items = filesQuery.data?.pages.flatMap((page) => page.data) ?? [];

  // Tab change — update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams();
    if (value !== 'all') {
      params.set('category', value);
    }
    const queryString = params.toString();
    router.push(queryString ? `/files?${queryString}` : '/files');
  };

  // Delete flow
  const handleDeleteClick = useCallback((file: UserFile) => {
    setDeleteFile(file);
    setIsDeleteOpen(true);
  }, []);

  // Download flow
  const handleDownload = useCallback(
    (file: UserFile) => {
      // For images with public URL, open directly
      if (file.url) {
        window.open(file.url, '_blank');
      } else {
        downloadMutation.mutate(file.id);
      }
    },
    [downloadMutation]
  );

  // Drag-and-drop on the page
  const handleDragDrop = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const isImage = IMAGE_TYPES.has(file.type);

        // Validate size
        const maxSize = isImage ? IMAGE_MAX_SIZE : DOCUMENT_MAX_SIZE;
        if (file.size > maxSize) {
          toast.error(
            `"${file.name}" is too large. Max ${isImage ? '5MB' : '10MB'}.`
          );
          continue;
        }

        if (isImage) {
          uploadImageMutation.mutate(file);
        } else {
          uploadDocumentMutation.mutate(file);
        }
      }
    },
    [uploadImageMutation, uploadDocumentMutation]
  );

  // Render content
  const renderContent = () => {
    if (filesQuery.isError) {
      return (
        <ErrorState
          title="Failed to load files"
          description="We couldn't load your files. Please try again."
          retry={() => filesQuery.refetch()}
        />
      );
    }

    if (!filesQuery.data?.pages[0]?.data || items.length === 0) {
      const hasFilter = activeTab !== 'all';
      return (
        <EmptyState
          icon={Files}
          title={hasFilter ? 'No files found' : 'No files yet'}
          description={
            hasFilter
              ? `You don't have any ${activeTab === 'content-image' ? 'images' : 'documents'} yet.`
              : 'Upload images and documents to see them here.'
          }
          action={
            hasFilter
              ? { label: 'View all files', onClick: () => handleTabChange('all') }
              : { label: 'Upload a file', onClick: () => setIsUploadOpen(true) }
          }
        />
      );
    }

    return (
      <>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((file, index) => (
            <FileCard
              key={file.id}
              file={file}
              index={index}
              onDelete={handleDeleteClick}
              onDownload={handleDownload}
            />
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {filesQuery.isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!filesQuery.hasNextPage && items.length > 0 && (
            <p className="text-sm text-muted-foreground">No more files</p>
          )}
        </div>
      </>
    );
  };

  return (
    <FileUpload onFilesAdded={handleDragDrop} multiple accept="*">
      <PageContainer variant="list">
        <PageHeader
          title="Files"
          description="Manage your uploaded images and documents."
        >
          <Button onClick={() => setIsUploadOpen(true)} size="sm">
            <Upload className="mr-1.5 h-4 w-4" />
            Upload
          </Button>
        </PageHeader>

        {/* Category tabs + content */}
        {filesQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-72 rounded-full" />
            <FilesGridSkeleton />
          </div>
        ) : (
          <>
            <AnimatedTabs
              tabs={CATEGORY_TABS.map((tab) => ({
                value: tab.value,
                label: tab.label,
              }))}
              value={activeTab}
              onValueChange={handleTabChange}
              className="animate-in slide-in-from-top-2 duration-300"
            />

            <div className="mt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              {renderContent()}
            </div>
          </>
        )}

        {/* Upload dialog */}
        <FileUploadDialog
          open={isUploadOpen}
          onOpenChange={setIsUploadOpen}
        />

        {/* Delete dialog */}
        <FileDeleteDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          file={deleteFile}
        />
      </PageContainer>

      {/* Full-screen drag overlay */}
      <FileUploadContent>
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-background/90 px-12 py-10 shadow-2xl">
          <Upload className="h-10 w-10 text-primary" />
          <p className="text-lg font-semibold">Drop files to upload</p>
          <p className="text-sm text-muted-foreground">
            Images and documents will be uploaded automatically
          </p>
        </div>
      </FileUploadContent>
    </FileUpload>
  );
}

/******************************************************************************
                               Skeleton
******************************************************************************/

function FilesGridSkeleton({ count = 8 }: { count?: number }) {
  const opacityValues = [1, 0.9, 0.7, 0.5, 0.35, 0.25, 0.15, 0.1];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => {
        const opacity = opacityValues[i] ?? 0.1;
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl border"
            style={{ opacity }}
          >
            <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
            <div className="space-y-1.5 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/******************************************************************************
                               Page Export
******************************************************************************/

function FilesPage() {
  return (
    <Suspense
      fallback={
        <PageContainer variant="list">
          <PageHeader
            title="Files"
            description="Manage your uploaded images and documents."
          />
          <div className="space-y-4">
            <Skeleton className="h-9 w-72 rounded-full" />
            <FilesGridSkeleton />
          </div>
        </PageContainer>
      }
    >
      <FilesPageContent />
    </Suspense>
  );
}

export default FilesPage;
