'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';

import {
  ContentRequestsTable,
  ContentRequestFilters,
  ContentRequestStatusDialog,
  ContentRequestFulfillDialog,
  ContentRequestRejectDialog,
} from '@/components/admin/content-requests';

import { useAdminContentRequests } from '@/lib/hooks/useAdminContentRequests';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminContentRequestsParams, ContentRequest } from '@/types/content-request';

/******************************************************************************
                                Page Content Component
******************************************************************************/

function ContentRequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchInput, 500);

  // Dialog states
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ContentRequest | null>(null);

  // Read params from URL
  const params = useMemo<AdminContentRequestsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort = (searchParams.get('sort') as 'created_at' | 'updated_at') || 'created_at';
    const direction = (searchParams.get('direction') as 'asc' | 'desc') || 'desc';
    const status = searchParams.get('status') as any;
    const type = searchParams.get('type') as any;

    return {
      page,
      per_page,
      sort,
      direction,
      search: debouncedSearch || undefined,
      status: status || undefined,
      type: type || undefined,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useAdminContentRequests(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminContentRequestsParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      const queryString = newParams.toString();
      router.push(
        queryString ? `/admin/content-requests?${queryString}` : '/admin/content-requests'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminContentRequestsParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'updated_at') => {
      updateParams({
        sort: sortBy,
        direction:
          params.sort === sortBy && params.direction === 'asc'
            ? 'desc'
            : 'asc',
      });
    },
    [updateParams, params.sort, params.direction]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  const handleUpdateStatus = useCallback((request: ContentRequest) => {
    setSelectedRequest(request);
    setStatusDialogOpen(true);
  }, []);

  const handleFulfill = useCallback((request: ContentRequest) => {
    setSelectedRequest(request);
    setFulfillDialogOpen(true);
  }, []);

  const handleReject = useCallback((request: ContentRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  }, []);

  const handleDialogSuccess = useCallback(() => {
    // Refresh the list
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Content Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <ContentRequestFilters
              params={params}
              onParamsChange={handleParamsChange}
            />
          </div>

          {/* Table */}
          <ContentRequestsTable
            requests={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
            onUpdateStatus={handleUpdateStatus}
            onFulfill={handleFulfill}
            onReject={handleReject}
          />

          {/* Pagination */}
          {data?.pagination && data.pagination.total > 0 && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              itemLabel="content request"
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ContentRequestStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        request={selectedRequest}
        onSuccess={handleDialogSuccess}
      />

      <ContentRequestFulfillDialog
        open={fulfillDialogOpen}
        onOpenChange={setFulfillDialogOpen}
        request={selectedRequest}
        onSuccess={handleDialogSuccess}
      />

      <ContentRequestRejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        request={selectedRequest}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}

/******************************************************************************
                                Default Export
******************************************************************************/

/**
 * Default component. Admin content requests list page.
 */
export default function ContentRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <ContentRequestsPageContent />
    </Suspense>
  );
}
