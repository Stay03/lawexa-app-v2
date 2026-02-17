'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { BroadcastsTable } from '@/components/admin/notifications/BroadcastsTable';

import { useAdminBroadcasts } from '@/lib/hooks/useAdminNotifications';
import type { BroadcastListParams } from '@/types/notification';

/******************************************************************************
                                Page Content Component
******************************************************************************/

function BroadcastsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<BroadcastListParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort =
      (searchParams.get('sort') as BroadcastListParams['sort']) || 'created_at';
    const direction =
      (searchParams.get('direction') as 'asc' | 'desc') || 'desc';

    return { page, per_page, sort, direction };
  }, [searchParams]);

  const { data, isLoading } = useAdminBroadcasts(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<BroadcastListParams>) => {
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
        queryString
          ? `/admin/notifications?${queryString}`
          : '/admin/notifications'
      );
    },
    [router, searchParams]
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'recipients_count' | 'title') => {
      updateParams({
        sort: sortBy,
        direction:
          params.sort === sortBy && params.direction === 'asc'
            ? 'desc'
            : 'asc',
        page: 1,
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

  const handlePerPageChange = useCallback(
    (per_page: number) => {
      updateParams({ per_page, page: 1 });
    },
    [updateParams]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Broadcast History</CardTitle>
          <Button onClick={() => router.push('/admin/notifications/broadcast')}>
            <Plus className="mr-2 h-4 w-4" />
            New Broadcast
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table */}
          <BroadcastsTable
            broadcasts={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
          />

          {/* Pagination */}
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              perPage={params.per_page}
              onPerPageChange={handlePerPageChange}
              itemLabel="broadcasts"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/******************************************************************************
                                Main Page Component
******************************************************************************/

export default function AdminBroadcastsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Broadcast History</CardTitle>
              <Skeleton className="h-10 w-[150px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <BroadcastsPageContent />
    </Suspense>
  );
}
