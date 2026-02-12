'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationAnalytics } from '@/lib/hooks/useAdmin';
import { AnalyticsPeriodSelector } from '@/components/admin/analytics/AnalyticsPeriodSelector';
import { AnalyticsStatCards } from '@/components/admin/analytics/AnalyticsStatCards';
import { AnalyticsCharts } from '@/components/admin/analytics/AnalyticsCharts';
import { AnalyticsRecentConversations } from '@/components/admin/analytics/AnalyticsRecentConversations';
import { AnalyticsTopUsers } from '@/components/admin/analytics/AnalyticsTopUsers';
import type { ConversationAnalyticsParams, AnalyticsPeriod } from '@/types/admin';

function ConversationAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<ConversationAnalyticsParams>(() => {
    const period =
      (searchParams.get('period') as AnalyticsPeriod) || '30d';
    const start_date = searchParams.get('start_date') || undefined;
    const end_date = searchParams.get('end_date') || undefined;
    return { period, start_date, end_date };
  }, [searchParams]);

  const { data, isLoading, error } = useConversationAnalytics(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<ConversationAnalyticsParams>) => {
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
          ? `/admin/conversations/analytics?${queryString}`
          : '/admin/conversations/analytics'
      );
    },
    [router, searchParams]
  );

  const handlePeriodChange = useCallback(
    (period: AnalyticsPeriod) => {
      if (period !== 'custom') {
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
        period: 'custom',
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
            Conversation Analytics
          </h1>
          <AnalyticsPeriodSelector
            period={(params.period as AnalyticsPeriod) || '30d'}
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
          Conversation Analytics
        </h1>
        <AnalyticsPeriodSelector
          period={(params.period as AnalyticsPeriod) || '30d'}
          startDate={params.start_date}
          endDate={params.end_date}
          onPeriodChange={handlePeriodChange}
          onCustomRangeChange={handleCustomRangeChange}
        />
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data?.data?.stat_cards ? (
        <AnalyticsStatCards statCards={data.data.stat_cards} />
      ) : null}

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[350px] rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[350px] rounded-2xl lg:col-span-2" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[350px] rounded-2xl" />
            <Skeleton className="h-[350px] rounded-2xl" />
          </div>
        </div>
      ) : data?.data?.charts ? (
        <AnalyticsCharts charts={data.data.charts} />
      ) : null}

      {/* Data Tables */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      ) : data?.data?.tables ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsRecentConversations
            conversations={data.data.tables.recent_conversations}
          />
          <AnalyticsTopUsers users={data.data.tables.top_users} />
        </div>
      ) : null}
    </div>
  );
}

export default function ConversationAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      }
    >
      <ConversationAnalyticsContent />
    </Suspense>
  );
}
