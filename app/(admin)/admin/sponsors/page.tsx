'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AdminSponsorFilters } from '@/components/admin/sponsors/AdminSponsorFilters';
import { AdminSponsorsTable } from '@/components/admin/sponsors/AdminSponsorsTable';
import { useAdminSponsors } from '@/lib/hooks/useAdminSponsors';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminSponsorsParams } from '@/types/admin-sponsors';

/******************************************************************************
                                 Component
******************************************************************************/

function AdminSponsorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(
    () => searchParams.get('search') ?? ''
  );
  const debouncedSearch = useDebounce(searchValue, 300);

  const params = useMemo<AdminSponsorsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    return {
      page,
      per_page,
      search: debouncedSearch || undefined,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useAdminSponsors(params);

  const updateParams = useCallback(
    (updates: Partial<AdminSponsorsParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      const queryString = newParams.toString();
      router.push(
        queryString ? `/admin/sponsors?${queryString}` : '/admin/sponsors'
      );
    },
    [router, searchParams]
  );

  // Sync debounced search to URL
  useEffect(() => {
    const currentSearch = searchParams.get('search') ?? '';
    if (debouncedSearch !== currentSearch) {
      updateParams({ search: debouncedSearch || undefined, page: 1 });
    }
  }, [debouncedSearch, searchParams, updateParams]);

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sponsors</h1>
        <Button asChild size="sm">
          <Link href="/admin/sponsors/new">
            <Plus className="mr-2 h-4 w-4" />
            New sponsor
          </Link>
        </Button>
      </div>

      <AdminSponsorFilters
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />

      <AdminSponsorsTable
        sponsors={data?.data || []}
        isLoading={isLoading}
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={handlePageChange}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) =>
            updateParams({ per_page: perPage, page: 1 })
          }
          itemLabel="sponsors"
        />
      )}
    </div>
  );
}

/******************************************************************************
                                 Export default
******************************************************************************/

export default function AdminSponsorsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-[140px]" />
            <Skeleton className="h-9 w-[140px]" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-full max-w-md" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <AdminSponsorsContent />
    </Suspense>
  );
}
