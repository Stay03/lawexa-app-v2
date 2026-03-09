'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserAnalytics } from '@/lib/hooks/useAdmin';
import { ViewAnalyticsPeriodSelector } from '@/components/admin/analytics/ViewAnalyticsPeriodSelector';
import { UserAnalyticsStatCards } from '@/components/admin/analytics/UserAnalyticsStatCards';
import { UserAnalyticsCharts } from '@/components/admin/analytics/UserAnalyticsCharts';
import { DailyBreakdownTable } from '@/components/admin/analytics/user-tables/DailyBreakdownTable';
import { UniversitiesTable } from '@/components/admin/analytics/user-tables/UniversitiesTable';
import { CurrencySettings } from '@/components/admin/CurrencySettings';
import type {
  UserAnalyticsParams,
  UserAnalyticsPeriod,
  CurrentlyOnlineCard,
} from '@/types/admin';

function OnlineIndicator({ online }: { online: CurrentlyOnlineCard }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900/50 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      {online.value} online
    </span>
  );
}

function UserAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<UserAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as UserAnalyticsPeriod) || 'last_30_days';
    const date = searchParams.get('date') || undefined;
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, date, start_date, end_date };
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
    (period: UserAnalyticsPeriod) => {
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

  const handleCustomRangeChange = useCallback(
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

  // Period selector shared across error and success states
  const periodSelector = (
    <div className="flex items-center gap-2">
      <ViewAnalyticsPeriodSelector
        period={(params.period as UserAnalyticsPeriod) || 'last_30_days'}
        date={params.date}
        startDate={params.start_date}
        endDate={params.end_date}
        onPeriodChange={handlePeriodChange}
        onDateChange={handleDateChange}
        onDateRangeChange={handleCustomRangeChange}
      />
      <CurrencySettings />
    </div>
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              User Analytics
            </h1>
          </div>
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            User Analytics
          </h1>
          {data?.data?.stat_cards && (
            <OnlineIndicator online={data.data.stat_cards.currently_online} />
          )}
        </div>
        {periodSelector}
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[160px] rounded-2xl" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <UserAnalyticsStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-[350px] rounded-2xl" />
              {i < 5 && <Skeleton className="h-[350px] rounded-2xl" />}
            </div>
          ))}
        </div>
      ) : data?.data?.charts ? (
        <UserAnalyticsCharts
          charts={data.data.charts}
          granularity={data.data.granularity}
        />
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
          <DailyBreakdownTable
            data={data.data.tables.daily_breakdown}
            granularity={data.data.granularity}
          />

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
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-[200px]" />
              <Skeleton className="h-6 w-[80px] rounded-full" />
            </div>
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-[160px] rounded-2xl" />
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
