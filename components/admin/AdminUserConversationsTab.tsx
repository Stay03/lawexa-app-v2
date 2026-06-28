'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminConversationsTable } from './AdminConversationsTable';
import { AdminPagination } from './AdminPagination';
import { useAdminUserConversations } from '@/lib/hooks/useAdmin';
import type { AdminUserConversationsParams } from '@/types/admin';

/**
 * Conversations tab on the admin User Details page. Owns its own URL-synced
 * paging/sort/status state so it can be lazily mounted only when its tab is
 * active. Per-conversation token/cost columns are hidden here (the user-level
 * totals live in the KPI strip; per-row usage is on the conversation detail).
 */
export function AdminUserConversationsTab({ uuid }: { uuid: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<AdminUserConversationsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by =
      (searchParams.get('sort_by') as AdminUserConversationsParams['sort_by']) ||
      'created_at';
    const sort_order =
      (searchParams.get(
        'sort_order'
      ) as AdminUserConversationsParams['sort_order']) || 'desc';
    const status = searchParams.get(
      'status'
    ) as AdminUserConversationsParams['status'] | null;

    return { page, per_page, sort_by, sort_order, status: status || undefined };
  }, [searchParams]);

  const { data, isLoading } = useAdminUserConversations(uuid, params);

  const updateParams = useCallback(
    (updates: Partial<AdminUserConversationsParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/users/${uuid}?${qs}` : `/admin/users/${uuid}`);
    },
    [router, searchParams, uuid]
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'updated_at' | 'title') => {
      updateParams({
        sort_by: sortBy,
        sort_order:
          params.sort_by === sortBy && params.sort_order === 'desc'
            ? 'asc'
            : 'desc',
      });
    },
    [updateParams, params.sort_by, params.sort_order]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={params.status ?? 'all'}
          onValueChange={(value) =>
            updateParams({
              status:
                value === 'all'
                  ? undefined
                  : (value as AdminUserConversationsParams['status']),
              page: 1,
            })
          }
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminConversationsTable
        conversations={data?.data || []}
        isLoading={isLoading}
        params={{ ...params, user_uuid: uuid }}
        onSort={handleSort}
        hideUserColumn
        hideUsageColumns
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={(page) => updateParams({ page })}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) =>
            updateParams({ per_page: perPage, page: 1 })
          }
          itemLabel="conversations"
        />
      )}
    </div>
  );
}
