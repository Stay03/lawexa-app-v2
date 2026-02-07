'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AiProviderFilters } from '@/components/admin/ai/AiProviderFilters';
import { AiProvidersTable } from '@/components/admin/ai/AiProvidersTable';
import { AiProviderFormDialog } from '@/components/admin/ai/AiProviderFormDialog';
import { AiProviderDeleteDialog } from '@/components/admin/ai/AiProviderDeleteDialog';
import { useAdminAiProviders } from '@/lib/hooks/useAdminAi';
import type { AdminAiProvidersParams } from '@/types/admin-ai';
import type { AdminAiProvider } from '@/types/admin-ai';

function AiProvidersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AdminAiProvider | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState<AdminAiProvider | null>(null);

  // Read params from URL
  const params = useMemo<AdminAiProvidersParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminAiProvidersParams['sort_by']) || 'name';
    const sort_order = (searchParams.get('sort_order') as AdminAiProvidersParams['sort_order']) || 'asc';
    const active_only = searchParams.get('active_only');

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      active_only: active_only === null ? undefined : active_only === 'true',
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminAiProviders(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminAiProvidersParams>) => {
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
          ? `/admin/ai/providers?${queryString}`
          : '/admin/ai/providers'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminAiProvidersParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: 'name' | 'created_at') => {
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

  const handleEdit = useCallback((provider: AdminAiProvider) => {
    setEditingProvider(provider);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((provider: AdminAiProvider) => {
    setDeletingProvider(provider);
    setDeleteOpen(true);
  }, []);

  const handleAddProvider = useCallback(() => {
    setEditingProvider(null);
    setFormOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>AI Providers</CardTitle>
          <Button onClick={handleAddProvider}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiProviderFilters
            params={params}
            onParamsChange={handleParamsChange}
          />

          <AiProvidersTable
            providers={data?.data || []}
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
              itemLabel="providers"
            />
          )}
        </CardContent>
      </Card>

      <AiProviderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        provider={editingProvider}
      />

      <AiProviderDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        provider={deletingProvider}
      />
    </div>
  );
}

export default function AiProvidersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>AI Providers</CardTitle>
              <Skeleton className="h-10 w-[130px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
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
      <AiProvidersPageContent />
    </Suspense>
  );
}
