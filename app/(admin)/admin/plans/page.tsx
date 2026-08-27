'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AdminPagination } from '@/components/admin';
import { AdminPlanFilters } from '@/components/admin/plans/AdminPlanFilters';
import { AdminPlansTable } from '@/components/admin/plans/AdminPlansTable';
import { useAdminPlans, useSyncPlans } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminPlansParams } from '@/types/admin-plans';

/******************************************************************************
                                 Component
******************************************************************************/

function AdminPlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<AdminPlansParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    /* 100, NOT 15 — AND THIS IS A WORKAROUND, NOT A PREFERENCE.
       Paging this endpoint loses rows. There is no stable tiebreak on the
       server, so the last page serves a reversed tail instead of the
       remainder: it reports 33 plans, returns 33 rows, and those rows contain
       only 30 distinct plans. Measured 27 August against production:

         per_page=10  -> 30 of 33 seen, the 3 missing all USD
         per_page=15  -> 30 of 33 seen, the 3 missing all USD   (the old default)
         per_page=25  -> 25 of 33 seen, EVERY USD plan missing
         per_page=50  -> all 33 seen
         per_page=100 -> all 33 seen

       One of the plans unreachable at the old default was Basic Monthly USD,
       which is the plan behind the only live dollar subscription — so an admin
       could not see the plan a paying customer was on. Asking for everything at
       once sidesteps the defect because there is then only one page to lose
       rows between. When the server sorts stably this can go back to paging. */
    const per_page = Number(searchParams.get('per_page')) || 100;
    const is_active_raw = searchParams.get('is_active');
    const is_active =
      is_active_raw === 'true'
        ? true
        : is_active_raw === 'false'
          ? false
          : undefined;
    return { page, per_page, is_active };
  }, [searchParams]);

  const { data, isLoading } = useAdminPlans(params);
  const syncMutation = useSyncPlans();

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminPlansParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      const queryString = newParams.toString();
      router.push(queryString ? `/admin/plans?${queryString}` : '/admin/plans');
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminPlansParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  const handleSync = useCallback(() => {
    syncMutation.mutate(undefined, {
      onSuccess: (response) => {
        toast.success(
          response.message ||
            `Synced ${response.data.synced_count} plans from Paystack.`
        );
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        toast.error(apiError.message);
      },
    });
  }, [syncMutation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync from Paystack
        </Button>
      </div>

      <AdminPlanFilters params={params} onParamsChange={handleParamsChange} />

      <AdminPlansTable plans={data?.data || []} isLoading={isLoading} />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={handlePageChange}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) =>
            handleParamsChange({ per_page: perPage, page: 1 })
          }
          itemLabel="plans"
        />
      )}
    </div>
  );
}

/******************************************************************************
                                 Export default
******************************************************************************/

export default function AdminPlansPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-[120px]" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[140px]" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <AdminPlansContent />
    </Suspense>
  );
}
