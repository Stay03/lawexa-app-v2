'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalyticsPeriodSelector } from '@/components/admin/analytics/AnalyticsPeriodSelector';
import { NotificationAnalyticsStatCards } from '@/components/admin/notifications/analytics/NotificationAnalyticsStatCards';
import { BroadcastsOverTimeChart } from '@/components/admin/notifications/analytics/BroadcastsOverTimeChart';
import { ReadVsUnreadChart } from '@/components/admin/notifications/analytics/ReadVsUnreadChart';
import { TargetTypeDistributionChart } from '@/components/admin/notifications/analytics/TargetTypeDistributionChart';
import {
  RecentBroadcastsTable,
  TopAdminsTable,
} from '@/components/admin/notifications/analytics/NotificationAnalyticsTables';
import { useNotificationAnalytics } from '@/lib/hooks/useAdminNotifications';
import type { NotificationAnalyticsParams } from '@/types/notification';
import type { AnalyticsPeriod } from '@/types/admin';

/******************************************************************************
                                Page Content
******************************************************************************/

function NotificationAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<NotificationAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as AnalyticsPeriod) || 'last_30_days';
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useNotificationAnalytics(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<NotificationAnalyticsParams>) => {
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
          ? `/admin/notifications/analytics?${queryString}`
          : '/admin/notifications/analytics'
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
            Notification Analytics
          </h1>
          <AnalyticsPeriodSelector
            period={(params.period as AnalyticsPeriod) || 'last_30_days'}
            startDate={params.start_date}
            endDate={params.end_date}
            onPeriodChange={handlePeriodChange}
            onCustomRangeChange={handleCustomRangeChange}
          />
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
          Notification Analytics
        </h1>
        <AnalyticsPeriodSelector
          period={(params.period as AnalyticsPeriod) || 'last_30_days'}
          startDate={params.start_date}
          endDate={params.end_date}
          onPeriodChange={handlePeriodChange}
          onCustomRangeChange={handleCustomRangeChange}
        />
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <NotificationAnalyticsStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[350px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[350px] rounded-2xl lg:col-span-2" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.charts ? (
        <div className="space-y-6">
          {/* Row 1: Broadcasts over time - full width */}
          <BroadcastsOverTimeChart
            data={data.data.charts.broadcasts_over_time}
          />

          {/* Row 2: Read vs Unread (2/3) + Target Distribution (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ReadVsUnreadChart data={data.data.charts.read_vs_unread} />
            </div>
            <TargetTypeDistributionChart
              data={data.data.charts.target_type_distribution}
            />
          </div>
        </div>
      ) : null}

      {/* Data Tables */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      ) : data?.data?.tables ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentBroadcastsTable
            broadcasts={data.data.tables.recent_broadcasts}
          />
          <TopAdminsTable
            admins={data.data.tables.top_admins_by_broadcasts}
          />
        </div>
      ) : null}
    </div>
  );
}

/******************************************************************************
                                Main Page
******************************************************************************/

export default function NotificationAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-8 w-[250px]" />
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
      <NotificationAnalyticsContent />
    </Suspense>
  );
}
