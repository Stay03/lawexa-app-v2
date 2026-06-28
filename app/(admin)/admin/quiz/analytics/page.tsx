'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminQuizPeriodSelect } from '@/components/admin/quiz/AdminQuizPeriodSelect';
import { AdminQuizUsageSection } from '@/components/admin/quiz/AdminQuizUsageSection';
import { AdminQuizMatchingSection } from '@/components/admin/quiz/AdminQuizMatchingSection';
import type { AdminQuizPeriod, AdminQuizPeriodParams } from '@/types/admin-quiz';

const PERIODS: AdminQuizPeriod[] = [
  'today',
  'last_24_hours',
  'date',
  'this_week',
  'last_7_days',
  'this_month',
  'last_30_days',
  'date_range',
];

/**
 * Usage analytics + matching-health. One period selector at the top drives both
 * sections; the period is URL-synced so a view can be deep-linked/shared.
 */
export default function AdminQuizAnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AdminQuizAnalyticsContent />
    </Suspense>
  );
}

function AdminQuizAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo<AdminQuizPeriodParams>(() => {
    const p = searchParams.get('period');
    return {
      period:
        p && (PERIODS as string[]).includes(p)
          ? (p as AdminQuizPeriod)
          : 'last_30_days',
      date: searchParams.get('date') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    };
  }, [searchParams]);

  const handleChange = useCallback(
    (value: AdminQuizPeriodParams) => {
      const next = new URLSearchParams();
      if (value.period) next.set('period', value.period);
      if (value.date) next.set('date', value.date);
      if (value.start_date) next.set('start_date', value.start_date);
      if (value.end_date) next.set('end_date', value.end_date);
      const qs = next.toString();
      router.push(qs ? `/admin/quiz/analytics?${qs}` : '/admin/quiz/analytics');
    },
    [router]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quiz analytics</h1>
          <p className="text-sm text-muted-foreground">
            How Quiz Mode is used, and whether cross-user matching is firing.
          </p>
        </div>
        <AdminQuizPeriodSelect value={params} onChange={handleChange} />
      </div>

      <AdminQuizUsageSection params={params} />
      <AdminQuizMatchingSection params={params} />
    </div>
  );
}
