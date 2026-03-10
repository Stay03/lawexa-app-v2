'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AdminMessagePackFilters } from '@/components/admin/message-packs/AdminMessagePackFilters';
import { AdminMessagePacksTable } from '@/components/admin/message-packs/AdminMessagePacksTable';
import { useAdminMessagePacks } from '@/lib/hooks/useAdmin';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminMessagePacksParams } from '@/types/admin';

/******************************************************************************
                                 Component
******************************************************************************/

function AdminMessagePacksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local search state for debouncing
  const [searchValue, setSearchValue] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchValue, 300);

  // Read params from URL
  const params = useMemo<AdminMessagePacksParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminMessagePacksParams['sort_by']) || 'created_at';
    const sort_order = (searchParams.get('sort_order') as AdminMessagePacksParams['sort_order']) || 'desc';
    const status = searchParams.get('status') as AdminMessagePacksParams['status'] | null;
    return {
      page,
      per_page,
      sort_by,
      sort_order,
      status: status || undefined,
      search: debouncedSearch || undefined,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useAdminMessagePacks(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminMessagePacksParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      const queryString = newParams.toString();
      router.push(queryString ? `/admin/message-packs?${queryString}` : '/admin/message-packs');
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
    (newParams: Partial<AdminMessagePacksParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: AdminMessagePacksParams['sort_by']) => {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Message Packs</h1>

      <AdminMessagePackFilters
        params={params}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onParamsChange={handleParamsChange}
      />

      <AdminMessagePacksTable
        messagePacks={data?.data || []}
        isLoading={isLoading}
        params={params}
        onSort={handleSort}
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={handlePageChange}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) => handleParamsChange({ per_page: perPage, page: 1 })}
          itemLabel="message packs"
        />
      )}
    </div>
  );
}

/******************************************************************************
                                 Export default
******************************************************************************/

export default function AdminMessagePacksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[200px]" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[260px]" />
            <Skeleton className="h-10 w-[140px]" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <AdminMessagePacksContent />
    </Suspense>
  );
}
