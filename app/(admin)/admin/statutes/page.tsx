'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Upload } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';

import { StatuteFilters } from '@/components/admin/statutes/StatuteFilters';
import { StatutesTable } from '@/components/admin/statutes/StatutesTable';
import { StatuteDeleteDialog } from '@/components/admin/statutes/StatuteDeleteDialog';

import { useAdminStatutes } from '@/lib/hooks/useAdminStatutes';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminStatutesParams, AdminStatute } from '@/types/admin-statutes';

/******************************************************************************
                                Page Content Component
******************************************************************************/

function StatutesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchInput, 500);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStatute, setDeletingStatute] = useState<AdminStatute | null>(null);

  const params = useMemo<AdminStatutesParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort = searchParams.get('sort') || 'created_at';
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
    const country = searchParams.get('country')
      ? Number(searchParams.get('country'))
      : undefined;
    const status = (searchParams.get('status') as AdminStatutesParams['status']) || undefined;
    const year = searchParams.get('year')
      ? Number(searchParams.get('year'))
      : undefined;

    return {
      page,
      per_page,
      sort,
      order,
      search: debouncedSearch || undefined,
      country,
      status,
      year,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useAdminStatutes(params);

  const updateParams = useCallback(
    (updates: Partial<AdminStatutesParams>) => {
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
        queryString ? `/admin/statutes?${queryString}` : '/admin/statutes'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminStatutesParams>) => {
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

  const handleDelete = useCallback((statute: AdminStatute) => {
    setDeletingStatute(statute);
    setDeleteOpen(true);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Statutes</CardTitle>
          <Button asChild>
            <Link href="/admin/statutes/import">
              <Upload className="mr-2 h-4 w-4" />
              Import Statute
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search statutes by title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <StatuteFilters params={params} onParamsChange={handleParamsChange} />

          {/* Table */}
          <StatutesTable
            statutes={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              itemLabel="statutes"
            />
          )}
        </CardContent>
      </Card>

      <StatuteDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        statute={deletingStatute}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

/******************************************************************************
                                Main Page Component
******************************************************************************/

export default function StatutesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Statutes</CardTitle>
              <Skeleton className="h-10 w-[150px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-10 w-[180px]" />
                <Skeleton className="h-10 w-[150px]" />
                <Skeleton className="h-10 w-[120px]" />
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
      <StatutesPageContent />
    </Suspense>
  );
}
