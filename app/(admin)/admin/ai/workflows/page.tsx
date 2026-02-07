'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AiWorkflowFilters } from '@/components/admin/ai/AiWorkflowFilters';
import { AiWorkflowsTable } from '@/components/admin/ai/AiWorkflowsTable';
import { AiWorkflowDeleteDialog } from '@/components/admin/ai/AiWorkflowDeleteDialog';
import { useAdminAiWorkflows } from '@/lib/hooks/useAdminAi';
import type { AdminAiWorkflowsParams, AdminAiWorkflow } from '@/types/admin-ai';

type WorkflowSortField = 'name' | 'created_at' | 'is_default';

function AiWorkflowsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<AdminAiWorkflow | null>(null);

  // Read params from URL
  const params = useMemo<AdminAiWorkflowsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminAiWorkflowsParams['sort_by']) || 'name';
    const sort_order = (searchParams.get('sort_order') as AdminAiWorkflowsParams['sort_order']) || 'asc';
    const active_only = searchParams.get('active_only');

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      active_only: active_only === null ? undefined : active_only === 'true',
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminAiWorkflows(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminAiWorkflowsParams>) => {
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
          ? `/admin/ai/workflows?${queryString}`
          : '/admin/ai/workflows'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminAiWorkflowsParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: WorkflowSortField) => {
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

  const handleEdit = useCallback(
    (workflow: AdminAiWorkflow) => {
      router.push(`/admin/ai/workflows/${workflow.id}/edit`);
    },
    [router]
  );

  const handleDelete = useCallback((workflow: AdminAiWorkflow) => {
    setDeletingWorkflow(workflow);
    setDeleteOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>AI Workflows</CardTitle>
          <Link href="/admin/ai/workflows/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Workflow
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiWorkflowFilters
            params={params}
            onParamsChange={handleParamsChange}
          />

          <AiWorkflowsTable
            workflows={data?.data || []}
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
              itemLabel="workflows"
            />
          )}
        </CardContent>
      </Card>

      <AiWorkflowDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workflow={deletingWorkflow}
      />
    </div>
  );
}

export default function AiWorkflowsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>AI Workflows</CardTitle>
              <Skeleton className="h-10 w-[140px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
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
      <AiWorkflowsPageContent />
    </Suspense>
  );
}
