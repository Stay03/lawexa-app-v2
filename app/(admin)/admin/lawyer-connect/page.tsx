'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { LawyerConnectTable } from '@/components/admin/lawyer-connect/LawyerConnectTable';
import { LawyerConnectFilters } from '@/components/admin/lawyer-connect/LawyerConnectFilters';
import { useAdminLawyerConnectList } from '@/lib/hooks/useAdminLawyerConnect';
import type {
  AdminLawyerConnectListParams,
  LawyerConnectSortBy,
  LawyerConnectStatus,
} from '@/types/admin-lawyer-connect';

function LawyerConnectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<AdminLawyerConnectListParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as LawyerConnectSortBy) || 'created_at';
    const sort_order = (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc';
    const status = searchParams.get('status') as LawyerConnectStatus | null;
    const lawyer_uuid = searchParams.get('lawyer_uuid') || undefined;

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      status: status || undefined,
      lawyer_uuid,
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminLawyerConnectList(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminLawyerConnectListParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      const queryString = newParams.toString();
      router.push(queryString ? `/admin/lawyer-connect?${queryString}` : '/admin/lawyer-connect');
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminLawyerConnectListParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'updated_at' | 'status') => {
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
      <h1 className="text-2xl font-semibold tracking-tight">
        Connection Requests
      </h1>

      <LawyerConnectFilters
        params={params}
        onParamsChange={handleParamsChange}
      />

      <LawyerConnectTable
        requests={data?.data || []}
        isLoading={isLoading}
        params={params}
        onSort={handleSort}
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={handlePageChange}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) =>
            handleParamsChange({ per_page: perPage, page: 1 })
          }
          itemLabel="requests"
        />
      )}
    </div>
  );
}

export default function LawyerConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[220px]" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[240px]" />
            <Skeleton className="h-10 w-[150px]" />
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
      <LawyerConnectPageContent />
    </Suspense>
  );
}
