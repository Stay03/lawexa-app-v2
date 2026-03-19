'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AdminFileFilters } from '@/components/admin/files/AdminFileFilters';
import { AdminFilesTable } from '@/components/admin/files/AdminFilesTable';
import { FileDetailSheet } from '@/components/admin/files/FileDetailSheet';
import { FileDeleteDialog } from '@/components/admin/files/FileDeleteDialog';
import { useAdminFiles, useAdminDownloadFile } from '@/lib/hooks/useAdminFiles';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminFileListParams, AdminFileSortBy, AdminFileListItem } from '@/types/admin-files';

function AdminFilesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local search state for debouncing
  const [searchValue, setSearchValue] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchValue, 300);

  // Sheet / dialog state
  const [detailFileId, setDetailFileId] = useState<number | null>(null);
  const [deleteFile, setDeleteFile] = useState<{ id: number; name: string } | null>(null);

  const downloadFile = useAdminDownloadFile();

  // Read params from URL
  const params = useMemo<AdminFileListParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminFileSortBy) || 'created_at';
    const sort_order = (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc';
    const category = searchParams.get('category') || undefined;
    const disk = searchParams.get('disk') || undefined;
    const upload_status = searchParams.get('upload_status') || undefined;
    const mime_type = searchParams.get('mime_type') || undefined;
    const uploaded_by = searchParams.get('uploaded_by')
      ? Number(searchParams.get('uploaded_by'))
      : undefined;
    const created_from = searchParams.get('created_from') || undefined;
    const created_to = searchParams.get('created_to') || undefined;
    const size_min = searchParams.get('size_min')
      ? Number(searchParams.get('size_min'))
      : undefined;
    const size_max = searchParams.get('size_max')
      ? Number(searchParams.get('size_max'))
      : undefined;

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      category,
      disk,
      upload_status,
      mime_type,
      uploaded_by,
      created_from,
      created_to,
      size_min,
      size_max,
      search: debouncedSearch || undefined,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useAdminFiles(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminFileListParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      const queryString = newParams.toString();
      router.push(queryString ? `/admin/files?${queryString}` : '/admin/files');
    },
    [router, searchParams]
  );

  // Sync debounced search to URL
  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      updateParams({ search: debouncedSearch || undefined, page: 1 });
    }
  }, [debouncedSearch, searchParams, updateParams]);

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminFileListParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: AdminFileSortBy) => {
      updateParams({
        sort_by: sortBy,
        sort_order:
          params.sort_by === sortBy && params.sort_order === 'desc' ? 'asc' : 'desc',
      });
    },
    [updateParams, params.sort_by, params.sort_order]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  const handleView = useCallback((file: AdminFileListItem) => {
    setDetailFileId(file.id);
  }, []);

  const handleDownload = useCallback(
    (file: AdminFileListItem) => {
      downloadFile.mutate(file.id);
    },
    [downloadFile]
  );

  const handleDeleteAction = useCallback((file: AdminFileListItem) => {
    setDeleteFile({ id: file.id, name: file.original_name });
  }, []);

  const handleDeleteFromSheet = useCallback((id: number, name: string) => {
    setDeleteFile({ id, name });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">File Management</h1>

      <AdminFileFilters
        params={params}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onParamsChange={handleParamsChange}
      />

      <AdminFilesTable
        files={data?.data || []}
        isLoading={isLoading}
        params={params}
        onSort={handleSort}
        onView={handleView}
        onDownload={handleDownload}
        onDelete={handleDeleteAction}
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={handlePageChange}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) => handleParamsChange({ per_page: perPage, page: 1 })}
          itemLabel="files"
        />
      )}

      {/* File Detail Sheet */}
      <FileDetailSheet
        open={detailFileId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailFileId(null);
        }}
        fileId={detailFileId}
        onDelete={handleDeleteFromSheet}
      />

      {/* Delete Confirmation */}
      <FileDeleteDialog
        open={deleteFile !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteFile(null);
        }}
        fileId={deleteFile?.id ?? null}
        fileName={deleteFile?.name ?? ''}
      />
    </div>
  );
}

export default function AdminFilesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[200px]" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[260px]" />
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[140px]" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <AdminFilesContent />
    </Suspense>
  );
}
