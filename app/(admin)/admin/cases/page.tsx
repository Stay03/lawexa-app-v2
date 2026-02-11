'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';

import { CaseFilters } from '@/components/admin/cases/CaseFilters';
import { CasesTable } from '@/components/admin/cases/CasesTable';
import { CaseDeleteDialog } from '@/components/admin/cases/CaseDeleteDialog';

import { useCases } from '@/lib/hooks/useAdminCases';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminCasesParams, CaseSummary } from '@/types/admin-cases';

/******************************************************************************
                                Page Content Component
******************************************************************************/

function CasesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  );
  const [debouncedSearch] = useDebounce(searchInput, 500);

  // Dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCase, setDeletingCase] = useState<CaseSummary | null>(null);

  // Read params from URL
  const params = useMemo<AdminCasesParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort = searchParams.get('sort') || 'created_at';
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
    const course = searchParams.get('course')
      ? Number(searchParams.get('course'))
      : undefined;
    const country = searchParams.get('country')
      ? Number(searchParams.get('country'))
      : undefined;
    const court = searchParams.get('court')
      ? Number(searchParams.get('court'))
      : undefined;
    const date_from = searchParams.get('date_from') || undefined;
    const date_to = searchParams.get('date_to') || undefined;

    return {
      page,
      per_page,
      sort,
      order,
      search: debouncedSearch || undefined,
      course,
      country,
      court,
      date_from,
      date_to,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useCases(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminCasesParams>) => {
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
        queryString ? `/admin/cases?${queryString}` : '/admin/cases'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminCasesParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: string) => {
      updateParams({
        sort: sortBy,
        order:
          params.sort === sortBy && params.order === 'asc'
            ? 'desc'
            : 'asc',
      });
    },
    [updateParams, params.sort, params.order]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  const handleEdit = useCallback(
    (caseData: CaseSummary) => {
      router.push(`/admin/cases/${caseData.id}/edit`);
    },
    [router]
  );

  const handleDelete = useCallback((caseData: CaseSummary) => {
    setDeletingCase(caseData);
    setDeleteOpen(true);
  }, []);

  const handleAddCase = useCallback(() => {
    router.push('/admin/cases/new');
  }, [router]);

  const handleDeleteSuccess = useCallback(() => {
    // Optionally refresh the list or navigate
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Cases</CardTitle>
          <Button onClick={handleAddCase}>
            <Plus className="mr-2 h-4 w-4" />
            Add Case
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases by title, body, or citation..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <CaseFilters params={params} onParamsChange={handleParamsChange} />

          {/* Table */}
          <CasesTable
            cases={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              itemLabel="cases"
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <CaseDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        case={deletingCase}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

/******************************************************************************
                                Main Page Component
******************************************************************************/

/**
 * Admin cases list page
 * Shows table with filters, search, pagination, and actions
 */
export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Cases</CardTitle>
              <Skeleton className="h-10 w-[120px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-10 w-[180px]" />
                <Skeleton className="h-10 w-[180px]" />
                <Skeleton className="h-10 w-[200px]" />
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
      <CasesPageContent />
    </Suspense>
  );
}
