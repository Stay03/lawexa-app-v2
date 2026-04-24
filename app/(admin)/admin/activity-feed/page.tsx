'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeedFilters, type FilterState } from '@/components/admin/activity/ActivityFeedFilters';
import { ActivityFeedList } from '@/components/admin/activity/ActivityFeedList';
import { ActivityFeedLiveToggle } from '@/components/admin/activity/ActivityFeedLiveToggle';
import { ActivityStatsChart } from '@/components/admin/activity/ActivityStatsChart';
import {
  useActivityFeed,
  useActivityFeedFacets,
  useActivityFeedStats,
} from '@/lib/hooks/useAdminActivity';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import type {
  ActivityAction,
  ActivityStatus,
} from '@/types/admin-activity';

function parseFilters(search: URLSearchParams): FilterState {
  const actions = search.getAll('action');
  return {
    search: search.get('search') ?? undefined,
    status: (search.get('status') as ActivityStatus) ?? undefined,
    is_bot:
      search.get('is_bot') === null
        ? undefined
        : search.get('is_bot') === 'true',
    action: actions.length
      ? (actions as ActivityAction[])
      : undefined,
    country: search.get('country') ?? undefined,
    university: search.get('university') ?? undefined,
    law_school: search.get('law_school') ?? undefined,
    profession: search.get('profession') ?? undefined,
    ip_address: search.get('ip_address') ?? undefined,
    device_id: search.get('device_id') ?? undefined,
    user_id: search.get('user_id')
      ? Number(search.get('user_id'))
      : undefined,
    subject_type: search.get('subject_type') ?? undefined,
    subject_id: search.get('subject_id')
      ? Number(search.get('subject_id'))
      : undefined,
    date_from: search.get('date_from') ?? undefined,
    date_to: search.get('date_to') ?? undefined,
  };
}

function toSearchParams(filters: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.search) p.set('search', filters.search);
  if (filters.status) p.set('status', filters.status);
  if (filters.is_bot !== undefined) p.set('is_bot', String(filters.is_bot));
  if (filters.action) filters.action.forEach((a) => p.append('action', a));
  if (filters.country) p.set('country', filters.country);
  if (filters.university) p.set('university', filters.university);
  if (filters.law_school) p.set('law_school', filters.law_school);
  if (filters.profession) p.set('profession', filters.profession);
  if (filters.ip_address) p.set('ip_address', filters.ip_address);
  if (filters.device_id) p.set('device_id', filters.device_id);
  if (filters.user_id) p.set('user_id', String(filters.user_id));
  if (filters.subject_type) p.set('subject_type', filters.subject_type);
  if (filters.subject_id) p.set('subject_id', String(filters.subject_id));
  if (filters.date_from) p.set('date_from', filters.date_from);
  if (filters.date_to) p.set('date_to', filters.date_to);
  return p;
}

function ActivityFeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const updateFilters = useCallback(
    (next: FilterState) => {
      const qs = toSearchParams(next).toString();
      router.push(qs ? `/admin/activity-feed?${qs}` : '/admin/activity-feed');
    },
    [router]
  );

  // Live polling state. Auto-pauses when user scrolls past the top sentinel.
  const [liveRequested, setLiveRequested] = useState(true);
  const { ref: topSentinelRef, isIntersecting: atTop } =
    useIntersectionObserver({ rootMargin: '0px', threshold: 0 });
  const live = liveRequested && atTop;

  const feed = useActivityFeed(filters, { live });
  const stats = useActivityFeedStats(filters);
  const facets = useActivityFeedFacets(filters);

  const lastUpdated = feed.dataUpdatedAt || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
          <p className="text-sm text-muted-foreground">
            Live timeline of user actions across the platform.
          </p>
        </div>
        <ActivityFeedLiveToggle
          live={live}
          onToggle={() => setLiveRequested((v) => !v)}
          lastUpdated={lastUpdated}
          isRefetching={feed.isRefetching}
          onRefresh={() => feed.refetch()}
        />
      </div>

      <ActivityFeedFilters
        value={filters}
        onChange={updateFilters}
        facets={facets.data?.data}
        facetsLoading={facets.isLoading}
      />

      <ActivityStatsChart
        data={stats.data?.data}
        isLoading={stats.isLoading}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent activity</CardTitle>
          {!atTop && liveRequested && (
            <span className="text-xs text-muted-foreground">
              Live paused while scrolled
            </span>
          )}
        </CardHeader>
        <CardContent>
          <ActivityFeedList
            pages={feed.data?.pages}
            isLoading={feed.isLoading}
            isFetchingNextPage={feed.isFetchingNextPage}
            hasNextPage={feed.hasNextPage}
            onLoadMore={() => feed.fetchNextPage()}
            error={feed.error as Error | null}
            topSentinelRef={topSentinelRef}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ActivityFeedPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[240px]" />
          <Skeleton className="h-10 w-full max-w-[720px]" />
          <Skeleton className="h-[320px] rounded-2xl" />
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      }
    >
      <ActivityFeedContent />
    </Suspense>
  );
}
