'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewAnalytics } from '@/lib/hooks/useAdmin';
import { ViewAnalyticsPeriodSelector } from '@/components/admin/analytics/ViewAnalyticsPeriodSelector';
import { ViewAnalyticsStatCards } from '@/components/admin/analytics/ViewAnalyticsStatCards';
import { ViewAnalyticsCharts } from '@/components/admin/analytics/ViewAnalyticsCharts';
import { TopViewedContentTable } from '@/components/admin/analytics/view-tables/TopViewedContentTable';
import { TopCrawledContentTable } from '@/components/admin/analytics/view-tables/TopCrawledContentTable';
import { RecentViewsTable } from '@/components/admin/analytics/view-tables/RecentViewsTable';
import { TopViewersTable } from '@/components/admin/analytics/view-tables/TopViewersTable';
import { TopSearchQueriesTable } from '@/components/admin/analytics/view-tables/TopSearchQueriesTable';
import { BotActivityTable } from '@/components/admin/analytics/view-tables/BotActivityTable';
import { TopBotsTable } from '@/components/admin/analytics/view-tables/TopBotsTable';
import { ViewsByCityTable } from '@/components/admin/analytics/view-tables/ViewsByCityTable';
import { TopUniversitiesViewTable } from '@/components/admin/analytics/view-tables/TopUniversitiesViewTable';
import type { ViewAnalyticsParams, ViewAnalyticsPeriod } from '@/types/admin';

function ViewAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<ViewAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as ViewAnalyticsPeriod) || 'last_30_days';
    const date = searchParams.get('date') || undefined;
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, date, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useViewAnalytics(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<ViewAnalyticsParams>) => {
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
          ? `/admin/views/analytics?${queryString}`
          : '/admin/views/analytics'
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

  // Period selector shared across error and success states
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
            Views Analytics
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
          Views Analytics
        </h1>
        {periodSelector}
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-2xl" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <ViewAnalyticsStatCards statCards={data.data.stat_cards} />
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
        <ViewAnalyticsCharts
          charts={data.data.charts}
          granularity={data.data.granularity}
        />
      ) : null}

      {/* Data Tables */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[300px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[300px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </div>
          <Skeleton className="h-[300px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[300px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[300px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.tables ? (
        <div className="space-y-6">
          {/* Top viewed content - full width */}
          <TopViewedContentTable data={data.data.tables.top_viewed_content} />

          {/* Recent views - full width */}
          <RecentViewsTable data={data.data.tables.recent_views} />

          {/* Top viewers + Top search queries - side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopViewersTable data={data.data.tables.top_viewers} />
            <TopSearchQueriesTable data={data.data.tables.top_search_queries} />
          </div>

          {/* Bot activity - full width */}
          <BotActivityTable data={data.data.tables.bot_activity} />

          {/* Top crawled content + Top bots - side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopCrawledContentTable data={data.data.tables.top_crawled_content} />
            <TopBotsTable data={data.data.tables.top_bots} />
          </div>

          {/* Views by city + Top universities - side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ViewsByCityTable data={data.data.tables.views_by_city} />
            <TopUniversitiesViewTable data={data.data.tables.top_universities} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ViewAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      }
    >
      <ViewAnalyticsContent />
    </Suspense>
  );
}
