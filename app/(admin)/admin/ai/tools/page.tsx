'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AiToolFilters } from '@/components/admin/ai/AiToolFilters';
import { AiToolsTable } from '@/components/admin/ai/AiToolsTable';
import { AiToolFormSheet } from '@/components/admin/ai/AiToolFormSheet';
import { AiToolDeleteDialog } from '@/components/admin/ai/AiToolDeleteDialog';
import { useAdminAiTools } from '@/lib/hooks/useAdminAi';
import type { AdminAiToolsParams, AdminAiTool } from '@/types/admin-ai';

type ToolSortField = 'name' | 'display_name' | 'category' | 'created_at';

function AiToolsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AdminAiTool | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTool, setDeletingTool] = useState<AdminAiTool | null>(null);

  // Read params from URL
  const params = useMemo<AdminAiToolsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminAiToolsParams['sort_by']) || 'name';
    const sort_order = (searchParams.get('sort_order') as AdminAiToolsParams['sort_order']) || 'asc';
    const category = searchParams.get('category') || undefined;
    const active_only = searchParams.get('active_only');

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      category,
      active_only: active_only === null ? undefined : active_only === 'true',
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminAiTools(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminAiToolsParams>) => {
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
          ? `/admin/ai/tools?${queryString}`
          : '/admin/ai/tools'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminAiToolsParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: ToolSortField) => {
      updateParams({
        sort_by: sortBy,
        sort_order:
          params.sort_by === sortBy && params.sort_order === 'asc'
            ? 'desc'
            : 'asc',
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

  const handleEdit = useCallback((tool: AdminAiTool) => {
    setEditingTool(tool);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((tool: AdminAiTool) => {
    setDeletingTool(tool);
    setDeleteOpen(true);
  }, []);

  const handleAddTool = useCallback(() => {
    setEditingTool(null);
    setFormOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>AI Tools</CardTitle>
          <Button onClick={handleAddTool}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tool
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiToolFilters
            params={params}
            onParamsChange={handleParamsChange}
          />

          <AiToolsTable
            tools={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              itemLabel="tools"
            />
          )}
        </CardContent>
      </Card>

      <AiToolFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        tool={editingTool}
      />

      <AiToolDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tool={deletingTool}
      />
    </div>
  );
}

export default function AiToolsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>AI Tools</CardTitle>
              <Skeleton className="h-10 w-[120px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-10 w-[180px]" />
                <Skeleton className="h-10 w-[130px]" />
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
      <AiToolsPageContent />
    </Suspense>
  );
}
