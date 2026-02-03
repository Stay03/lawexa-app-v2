'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdminConversationsTable,
  AdminConversationFilters,
  AdminPagination,
} from '@/components/admin';
import { useAdminConversations } from '@/lib/hooks/useAdmin';
import type { AdminConversationsParams } from '@/types/admin';

function AdminConversationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<AdminConversationsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminConversationsParams['sort_by']) || 'created_at';
    const sort_order = (searchParams.get('sort_order') as AdminConversationsParams['sort_order']) || 'desc';
    const status = searchParams.get('status') as AdminConversationsParams['status'] | null;
    const is_private = searchParams.get('is_private');
    const user_uuid = searchParams.get('user_uuid') || undefined;

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      status: status || undefined,
      is_private: is_private === null ? undefined : is_private === 'true',
      user_uuid,
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminConversations(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminConversationsParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else if (typeof value === 'boolean') {
          newParams.set(key, String(value));
        } else {
          newParams.set(key, String(value));
        }
      });

      const queryString = newParams.toString();
      router.push(queryString ? `/admin/conversations?${queryString}` : '/admin/conversations');
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminConversationsParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'updated_at' | 'title') => {
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
      <Card>
        <CardHeader>
          <CardTitle>All Conversations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminConversationFilters
            params={params}
            onParamsChange={handleParamsChange}
          />

          <AdminConversationsTable
            conversations={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
          />

          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminConversationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-10 w-[200px]" />
                <Skeleton className="h-10 w-[140px]" />
                <Skeleton className="h-10 w-[140px]" />
                <Skeleton className="h-10 w-[100px]" />
              </div>
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
      <AdminConversationsPageContent />
    </Suspense>
  );
}
