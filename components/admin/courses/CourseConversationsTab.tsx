'use client';

import { useCallback, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminConversationsTable } from '@/components/admin/AdminConversationsTable';
import { AdminPagination } from '@/components/admin';
import { useAdminCourseConversations } from '@/lib/hooks/useAdmin';
import type { AdminCourseConversationsParams } from '@/types/admin';

interface CourseConversationsTabProps {
  courseSlug: string;
}

/**
 * Conversations linked to a course (via their topics). Reuses the global
 * conversations table with the extra per-row course topics shown inline.
 * Rows link to the shared conversation detail page.
 */
export function CourseConversationsTab({
  courseSlug,
}: CourseConversationsTabProps) {
  const [params, setParams] = useState<AdminCourseConversationsParams>({
    page: 1,
    per_page: 15,
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  const { data, isLoading } = useAdminCourseConversations(courseSlug, params);

  const updateParams = useCallback(
    (updates: Partial<AdminCourseConversationsParams>) => {
      setParams((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'updated_at' | 'title') => {
      setParams((prev) => ({
        ...prev,
        sort_by: sortBy,
        sort_order:
          prev.sort_by === sortBy && prev.sort_order === 'desc'
            ? 'asc'
            : 'desc',
      }));
    },
    []
  );

  const privacyValue =
    params.is_private === undefined
      ? 'all'
      : params.is_private
        ? 'private'
        : 'public';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={params.status ?? 'all'}
          onValueChange={(value) =>
            updateParams({
              status:
                value === 'all' ? undefined : (value as 'active' | 'archived'),
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

        <Select
          value={privacyValue}
          onValueChange={(value) =>
            updateParams({
              is_private: value === 'all' ? undefined : value === 'private',
              page: 1,
            })
          }
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any privacy</SelectItem>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminConversationsTable
        conversations={data?.data || []}
        isLoading={isLoading}
        params={params}
        onSort={handleSort}
        showTopics
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={(page) => updateParams({ page })}
          onPerPageChange={(perPage) =>
            updateParams({ per_page: perPage, page: 1 })
          }
          perPage={params.per_page || 15}
          itemLabel="conversations"
        />
      )}
    </div>
  );
}
