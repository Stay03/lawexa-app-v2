'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';
import { AdminUserFilters } from '@/components/admin/AdminUserFilters';
import { useAdminUsers } from '@/lib/hooks/useAdmin';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { IAdminUserListParams, TAdminUserSortBy } from '@/types/admin';

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Content component for the admin users page.
 */
function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local search state for debouncing
  const [searchValue, setSearchValue] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchValue, 300);

  // Read params from URL
  const params = useMemo<IAdminUserListParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as TAdminUserSortBy) || 'created_at';
    const sort_order = (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc';
    // Multi-select array params
    const role = searchParams.getAll('role');
    const auth_provider = searchParams.getAll('auth_provider');
    const profession = searchParams.getAll('profession');
    const country = searchParams.getAll('country');
    const subscription_plan = searchParams.getAll('subscription_plan');
    // Boolean filters
    const is_online = searchParams.get('is_online');
    const has_payg_balance = searchParams.get('has_payg_balance');
    const is_creator = searchParams.get('is_creator');
    const is_verified = searchParams.get('is_verified');
    // Date range
    const created_from = searchParams.get('created_from') || undefined;
    const created_to = searchParams.get('created_to') || undefined;
    return {
      page,
      per_page,
      sort_by,
      sort_order,
      role: role.length > 0 ? role : undefined,
      auth_provider: auth_provider.length > 0 ? auth_provider : undefined,
      profession: profession.length > 0 ? profession : undefined,
      country: country.length > 0 ? country : undefined,
      subscription_plan: subscription_plan.length > 0 ? subscription_plan : undefined,
      is_online: is_online === null ? undefined : is_online === 'true',
      has_payg_balance: has_payg_balance === null ? undefined : has_payg_balance === 'true',
      is_creator: is_creator === null ? undefined : is_creator === 'true',
      is_verified: is_verified === null ? undefined : is_verified === 'true',
      created_from,
      created_to,
      search: debouncedSearch || undefined,
    };
  }, [searchParams, debouncedSearch]);

  const { data, isLoading } = useAdminUsers(params);

  // Update URL params (supports scalar and array values)
  const updateParams = useCallback(
    (updates: Partial<IAdminUserListParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.delete(key);
          value.forEach((v) => newParams.append(key, String(v)));
        } else if (typeof value === 'boolean') {
          newParams.set(key, String(value));
        } else {
          newParams.set(key, String(value));
        }
      });
      const queryString = newParams.toString();
      router.push(queryString ? `/admin/users?${queryString}` : '/admin/users');
    },
    [router, searchParams]
  );

  // Sync debounced search to URL
  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      updateParams({ search: debouncedSearch || undefined, page: 1 });
    }
  }, [debouncedSearch, searchParams, updateParams]);

  const handleParamsChange = useCallback(
    (newParams: Partial<IAdminUserListParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: TAdminUserSortBy) => {
      updateParams({
        sort_by: sortBy,
        sort_order:
          params.sort_by === sortBy && params.sort_order === 'desc' ? 'asc' : 'desc',
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>

      <AdminUserFilters
        params={params}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onParamsChange={handleParamsChange}
      />

      <AdminUsersTable
        users={data?.data || []}
        isLoading={isLoading}
        params={params}
        onSort={handleSort}
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={handlePageChange}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) => handleParamsChange({ per_page: perPage, page: 1 })}
          itemLabel="users"
        />
      )}
    </div>
  );
}

/******************************************************************************
                                 Export default
******************************************************************************/

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[200px]" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[260px]" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[130px]" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
