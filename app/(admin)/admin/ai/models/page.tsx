'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AiModelFilters } from '@/components/admin/ai/AiModelFilters';
import { AiModelsTable } from '@/components/admin/ai/AiModelsTable';
import { AiModelFormSheet } from '@/components/admin/ai/AiModelFormSheet';
import { AiModelDeleteDialog } from '@/components/admin/ai/AiModelDeleteDialog';
import { useAdminAiModels } from '@/lib/hooks/useAdminAi';
import type { AdminAiModelsParams, AdminAiModel } from '@/types/admin-ai';

type ModelSortField = 'name' | 'input_price_per_1m' | 'output_price_per_1m' | 'max_context_tokens' | 'created_at';

function AiModelsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AdminAiModel | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingModel, setDeletingModel] = useState<AdminAiModel | null>(null);

  // Read params from URL
  const params = useMemo<AdminAiModelsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminAiModelsParams['sort_by']) || 'name';
    const sort_order = (searchParams.get('sort_order') as AdminAiModelsParams['sort_order']) || 'asc';
    const provider_id = searchParams.get('provider_id');
    const supports_vision = searchParams.get('supports_vision');
    const supports_streaming = searchParams.get('supports_streaming');

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      provider_id: provider_id ? Number(provider_id) : undefined,
      supports_vision: supports_vision === null ? undefined : supports_vision === 'true',
      supports_streaming: supports_streaming === null ? undefined : supports_streaming === 'true',
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminAiModels(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminAiModelsParams>) => {
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
          ? `/admin/ai/models?${queryString}`
          : '/admin/ai/models'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminAiModelsParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: ModelSortField) => {
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

  const handleEdit = useCallback((model: AdminAiModel) => {
    setEditingModel(model);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((model: AdminAiModel) => {
    setDeletingModel(model);
    setDeleteOpen(true);
  }, []);

  const handleAddModel = useCallback(() => {
    setEditingModel(null);
    setFormOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>AI Models</CardTitle>
          <Button onClick={handleAddModel}>
            <Plus className="mr-2 h-4 w-4" />
            Add Model
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiModelFilters
            params={params}
            onParamsChange={handleParamsChange}
          />

          <AiModelsTable
            models={data?.data || []}
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
              itemLabel="models"
            />
          )}
        </CardContent>
      </Card>

      <AiModelFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        model={editingModel}
      />

      <AiModelDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        model={deletingModel}
      />
    </div>
  );
}

export default function AiModelsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>AI Models</CardTitle>
              <Skeleton className="h-10 w-[120px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-10 w-[180px]" />
                <Skeleton className="h-10 w-[130px]" />
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
      <AiModelsPageContent />
    </Suspense>
  );
}
