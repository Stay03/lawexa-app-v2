'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessagePackAnalytics } from '@/lib/hooks/useAdmin';
import { AnalyticsPeriodSelector } from '@/components/admin/analytics/AnalyticsPeriodSelector';
import { MessagePackStatCards } from '@/components/admin/analytics/message-pack/MessagePackStatCards';
import { MessagePackCharts } from '@/components/admin/analytics/message-pack/MessagePackCharts';
import { TopBuyersTable } from '@/components/admin/analytics/message-pack/tables/TopBuyersTable';
import { RecentPurchasesTable } from '@/components/admin/analytics/message-pack/tables/RecentPurchasesTable';
import type { MessagePackAnalyticsParams, AnalyticsPeriod } from '@/types/admin';

function MessagePackAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<MessagePackAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as AnalyticsPeriod) || 'last_30_days';
    const date = searchParams.get('date') || undefined;
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, date, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useMessagePackAnalytics(params);

  const granularity = data?.data?.granularity ?? 'day';

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<MessagePackAnalyticsParams>) => {
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
          ? `/admin/message-packs/analytics?${queryString}`
          : '/admin/message-packs/analytics'
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
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Message Pack Analytics
          </h1>
          {periodSelector}
        </div>
        <div className="rounded-lg border py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">Failed to load analytics data. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Message Pack Analytics
        </h1>
        {periodSelector}
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))}
          </div>
        </div>
      ) : data?.data?.stat_cards ? (
        <MessagePackStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-[350px] rounded-2xl" />
              <Skeleton className="h-[350px] rounded-2xl" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.charts ? (
        <MessagePackCharts
          charts={data.data.charts}
          granularity={granularity}
        />
      ) : null}

      {/* Data Tables */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-4 w-36" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[300px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.tables ? (
        <section className="space-y-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Detailed Breakdown
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopBuyersTable data={data.data.tables.top_buyers} />
            <RecentPurchasesTable data={data.data.tables.recent_purchases} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function MessagePackAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-8 w-[280px]" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-[120px] rounded-2xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-[120px] rounded-2xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      }
    >
      <MessagePackAnalyticsContent />
    </Suspense>
  );
}
