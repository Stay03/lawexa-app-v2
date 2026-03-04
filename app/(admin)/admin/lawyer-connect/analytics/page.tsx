'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminLawyerConnectAnalytics } from '@/lib/hooks/useAdminLawyerConnect';
import { AnalyticsPeriodSelector } from '@/components/admin/analytics/AnalyticsPeriodSelector';
import { LawyerConnectStatCards } from '@/components/admin/lawyer-connect/LawyerConnectStatCards';
import { LawyerConnectRequestsChart } from '@/components/admin/lawyer-connect/LawyerConnectRequestsChart';
import { LawyerConnectTopLawyersTable } from '@/components/admin/lawyer-connect/LawyerConnectTopLawyersTable';
import type { AdminLawyerConnectAnalyticsParams } from '@/types/admin-lawyer-connect';
import type { AnalyticsPeriod } from '@/types/admin';

function LawyerConnectAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<AdminLawyerConnectAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as AnalyticsPeriod) || 'last_30_days';
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useAdminLawyerConnectAnalytics(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminLawyerConnectAnalyticsParams>) => {
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
        queryString
          ? `/admin/lawyer-connect/analytics?${queryString}`
          : '/admin/lawyer-connect/analytics'
      );
    },
    [router, searchParams]
  );

  const handlePeriodChange = useCallback(
    (period: AnalyticsPeriod) => {
      if (period !== 'date_range') {
        updateParams({ period, start_date: undefined, end_date: undefined });
      } else {
        updateParams({ period });
      }
    },
    [updateParams]
  );

  const handleCustomRangeChange = useCallback(
    (startDate: string, endDate: string) => {
      updateParams({ period: 'date_range', start_date: startDate, end_date: endDate });
    },
    [updateParams]
  );

  const PeriodSelector = (
    <AnalyticsPeriodSelector
      period={(params.period as AnalyticsPeriod) || 'last_30_days'}
      startDate={params.start_date}
      endDate={params.end_date}
      onPeriodChange={handlePeriodChange}
      onCustomRangeChange={handleCustomRangeChange}
    />
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Connection Analytics
          </h1>
          {PeriodSelector}
        </div>
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          Failed to load analytics data. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Connection Analytics
        </h1>
        {PeriodSelector}
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <LawyerConnectStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-[380px] rounded-2xl" />
      ) : data?.data?.charts?.requests_over_time ? (
        <LawyerConnectRequestsChart
          data={data.data.charts.requests_over_time}
        />
      ) : null}

      {/* Top Lawyers Table */}
      {isLoading ? (
        <Skeleton className="h-[360px] rounded-2xl" />
      ) : data?.data?.tables?.top_lawyers ? (
        <LawyerConnectTopLawyersTable
          lawyers={data.data.tables.top_lawyers}
        />
      ) : null}
    </div>
  );
}

export default function LawyerConnectAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-8 w-[220px]" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[380px] rounded-2xl" />
          <Skeleton className="h-[360px] rounded-2xl" />
        </div>
      }
    >
      <LawyerConnectAnalyticsContent />
    </Suspense>
  );
}
