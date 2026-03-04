'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserAnalytics } from '@/lib/hooks/useAdmin';
import { AnalyticsPeriodSelector } from '@/components/admin/analytics/AnalyticsPeriodSelector';
import { UserAnalyticsStatCards } from '@/components/admin/analytics/UserAnalyticsStatCards';
import { UserAnalyticsCharts } from '@/components/admin/analytics/UserAnalyticsCharts';
import { DailyBreakdownTable } from '@/components/admin/analytics/user-tables/DailyBreakdownTable';
import { UniversitiesTable } from '@/components/admin/analytics/user-tables/UniversitiesTable';
import { CurrencySettings } from '@/components/admin/CurrencySettings';
import type { UserAnalyticsParams, AnalyticsPeriod } from '@/types/admin';

function UserAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<UserAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as AnalyticsPeriod) || 'last_30_days';
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useUserAnalytics(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<UserAnalyticsParams>) => {
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
          ? `/admin/users/analytics?${queryString}`
          : '/admin/users/analytics'
      );
    },
    [router, searchParams]
  );

  const handlePeriodChange = useCallback(
    (period: AnalyticsPeriod) => {
      if (period !== 'date_range') {
        updateParams({
          period,
          start_date: undefined,
          end_date: undefined,
        });
      } else {
        updateParams({ period });
      }
    },
    [updateParams]
  );

  const handleCustomRangeChange = useCallback(
    (startDate: string, endDate: string) => {
      updateParams({
        period: 'date_range',
        start_date: startDate,
        end_date: endDate,
      });
    },
    [updateParams]
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            User Analytics
          </h1>
          <div className="flex items-center gap-2">
            <AnalyticsPeriodSelector
              period={(params.period as AnalyticsPeriod) || 'last_30_days'}
              startDate={params.start_date}
              endDate={params.end_date}
              onPeriodChange={handlePeriodChange}
              onCustomRangeChange={handleCustomRangeChange}
            />
            <CurrencySettings />
          </div>
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
          User Analytics
        </h1>
        <div className="flex items-center gap-2">
          <AnalyticsPeriodSelector
            period={(params.period as AnalyticsPeriod) || 'last_30_days'}
            startDate={params.start_date}
            endDate={params.end_date}
            onPeriodChange={handlePeriodChange}
            onCustomRangeChange={handleCustomRangeChange}
          />
          <CurrencySettings />
        </div>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <UserAnalyticsStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[350px] rounded-2xl" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[350px] rounded-2xl" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[350px] rounded-2xl" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[350px] rounded-2xl" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.charts ? (
        <UserAnalyticsCharts charts={data.data.charts} />
      ) : null}

      {/* Tables Section */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[400px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[300px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.tables ? (
        <div className="space-y-6">
          {/* Daily Breakdown - full width */}
          <DailyBreakdownTable data={data.data.tables.daily_breakdown} />

          {/* Universities tables - side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UniversitiesTable
              title="Top Universities"
              description="Universities with the most users"
              data={data.data.tables.top_universities}
            />
            <UniversitiesTable
              title="International Universities"
              description="Universities outside Nigeria"
              data={data.data.tables.international_universities}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function UserAnalyticsPage() {
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
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      }
    >
      <UserAnalyticsContent />
    </Suspense>
  );
}
