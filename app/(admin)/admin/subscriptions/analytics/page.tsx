'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscriptionAnalytics } from '@/lib/hooks/useAdmin';
import { AnalyticsPeriodSelector } from '@/components/admin/analytics/AnalyticsPeriodSelector';
import { SubscriptionStatCards } from '@/components/admin/analytics/subscription/SubscriptionStatCards';
import { SubscriptionCharts } from '@/components/admin/analytics/subscription/SubscriptionCharts';
import { PlanBreakdownTable } from '@/components/admin/analytics/subscription/tables/PlanBreakdownTable';
import { RecentSubscriptionsTable } from '@/components/admin/analytics/subscription/tables/RecentSubscriptionsTable';
import { TopRevenueUsersTable } from '@/components/admin/analytics/subscription/tables/TopRevenueUsersTable';
import type { SubscriptionAnalyticsParams, AnalyticsPeriod } from '@/types/admin';

function SubscriptionAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<SubscriptionAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as AnalyticsPeriod) || 'last_30_days';
    const date = searchParams.get('date') || undefined;
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, date, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useSubscriptionAnalytics(params);

  const granularity = data?.data?.granularity ?? 'day';

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<SubscriptionAnalyticsParams>) => {
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
          ? `/admin/subscriptions/analytics?${queryString}`
          : '/admin/subscriptions/analytics'
      );
    },
    [router, searchParams]
  );

  const handlePeriodChange = useCallback(
    (period: AnalyticsPeriod) => {
      if (period !== 'date_range' && period !== 'date') {
        updateParams({
          period,
          date: undefined,
          start_date: undefined,
          end_date: undefined,
        });
      } else {
        updateParams({ period });
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

  const periodSelector = (
    <AnalyticsPeriodSelector
      period={(params.period as AnalyticsPeriod) || 'last_30_days'}
      date={params.date}
      startDate={params.start_date}
      endDate={params.end_date}
      onPeriodChange={handlePeriodChange}
      onDateChange={handleDateChange}
      onCustomRangeChange={handleCustomRangeChange}
    />
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Subscription Analytics
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
          Subscription Analytics
        </h1>
        {periodSelector}
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-2xl" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <SubscriptionStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[350px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[350px] rounded-2xl" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[350px] rounded-2xl" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      ) : data?.data?.charts ? (
        <SubscriptionCharts
          charts={data.data.charts}
          granularity={granularity}
        />
      ) : null}

      {/* Data Tables */}
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
          <PlanBreakdownTable data={data.data.tables.plan_breakdown} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentSubscriptionsTable
              data={data.data.tables.recent_subscriptions}
            />
            <TopRevenueUsersTable
              data={data.data.tables.top_revenue_users}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SubscriptionAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-8 w-[260px]" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      }
    >
      <SubscriptionAnalyticsContent />
    </Suspense>
  );
}
