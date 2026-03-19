'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminFileAnalytics } from '@/lib/hooks/useAdminFiles';
import { ViewAnalyticsPeriodSelector } from '@/components/admin/analytics/ViewAnalyticsPeriodSelector';
import { FileAnalyticsStatCards } from '@/components/admin/files/FileAnalyticsStatCards';
import { FileAnalyticsCharts } from '@/components/admin/files/FileAnalyticsCharts';
import { TopUploadersTable } from '@/components/admin/files/tables/TopUploadersTable';
import { LargestFilesTable } from '@/components/admin/files/tables/LargestFilesTable';
import { RecentUploadsTable } from '@/components/admin/files/tables/RecentUploadsTable';
import type { AdminFileAnalyticsParams } from '@/types/admin-files';
import type { ViewAnalyticsPeriod } from '@/types/admin';

function FileAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<AdminFileAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as ViewAnalyticsPeriod) || 'last_30_days';
    const date = searchParams.get('date') || undefined;
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, date, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useAdminFileAnalytics(params);

  const updateParams = useCallback(
    (updates: Partial<AdminFileAnalyticsParams>) => {
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
          ? `/admin/files/analytics?${queryString}`
          : '/admin/files/analytics'
      );
    },
    [router, searchParams]
  );

  const handlePeriodChange = useCallback(
    (period: ViewAnalyticsPeriod) => {
      if (period === 'date' || period === 'date_range') {
        updateParams({ period });
      } else {
        updateParams({
          period,
          date: undefined,
          start_date: undefined,
          end_date: undefined,
        });
      }
    },
    [updateParams]
  );

  const handleDateChange = useCallback(
    (date: string) => {
      updateParams({
        period: 'date',
        date,
        start_date: undefined,
        end_date: undefined,
      });
    },
    [updateParams]
  );

  const handleDateRangeChange = useCallback(
    (startDate: string, endDate: string) => {
      updateParams({
        period: 'date_range',
        date: undefined,
        start_date: startDate,
        end_date: endDate,
      });
    },
    [updateParams]
  );

  const periodSelector = (
    <ViewAnalyticsPeriodSelector
      period={(params.period as ViewAnalyticsPeriod) || 'last_30_days'}
      date={params.date}
      startDate={params.start_date}
      endDate={params.end_date}
      onPeriodChange={handlePeriodChange}
      onDateChange={handleDateChange}
      onDateRangeChange={handleDateRangeChange}
    />
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            File Analytics
          </h1>
          {periodSelector}
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
          File Analytics
        </h1>
        {periodSelector}
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[90px] rounded-lg" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <FileAnalyticsStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[350px] rounded-2xl" />
          <Skeleton className="h-[350px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[250px] rounded-2xl" />
            <Skeleton className="h-[250px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.charts ? (
        <FileAnalyticsCharts
          charts={data.data.charts}
          granularity={data.data.granularity}
        />
      ) : null}

      {/* Data Tables */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[300px] rounded-2xl" />
          <Skeleton className="h-[300px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      ) : data?.data?.tables ? (
        <div className="space-y-6">
          <TopUploadersTable data={data.data.tables.top_uploaders} />
          <LargestFilesTable data={data.data.tables.largest_files} />
          <RecentUploadsTable data={data.data.tables.recent_uploads} />
        </div>
      ) : null}
    </div>
  );
}

export default function FileAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[90px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      }
    >
      <FileAnalyticsContent />
    </Suspense>
  );
}
