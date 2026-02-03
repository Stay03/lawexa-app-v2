'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AdminConversationsTable,
  AdminConversationFilters,
  AdminPagination,
} from '@/components/admin';
import { useAdminConversations } from '@/lib/hooks/useAdmin';
import type { AdminConversationsParams } from '@/types/admin';

export default function AdminConversationsPage() {
  const [params, setParams] = useState<AdminConversationsParams>({
    page: 1,
    per_page: 15,
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  const { data, isLoading } = useAdminConversations(params);

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminConversationsParams>) => {
      setParams((prev) => ({ ...prev, ...newParams }));
    },
    []
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'updated_at' | 'title') => {
      setParams((prev) => ({
        ...prev,
        sort_by: sortBy,
        sort_order:
          prev.sort_by === sortBy && prev.sort_order === 'desc' ? 'asc' : 'desc',
      }));
    },
    []
  );

  const handlePageChange = useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page }));
  }, []);

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
