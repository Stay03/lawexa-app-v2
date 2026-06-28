'use client';

import { useState } from 'react';
import { AdminQuizPeriodSelect } from '@/components/admin/quiz/AdminQuizPeriodSelect';
import { AdminQuizUsageSection } from '@/components/admin/quiz/AdminQuizUsageSection';
import { AdminQuizMatchingSection } from '@/components/admin/quiz/AdminQuizMatchingSection';
import type { AdminQuizPeriod } from '@/types/admin-quiz';

/**
 * Usage analytics + matching-health. One period selector at the top drives both
 * sections; each section owns its own period-aware query.
 */
export default function AdminQuizAnalyticsPage() {
  const [period, setPeriod] = useState<AdminQuizPeriod>('last_30_days');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quiz analytics</h1>
          <p className="text-sm text-muted-foreground">
            How Quiz Mode is used, and whether cross-user matching is firing.
          </p>
        </div>
        <AdminQuizPeriodSelect value={period} onChange={setPeriod} />
      </div>

      <AdminQuizUsageSection period={period} />
      <AdminQuizMatchingSection period={period} />
    </div>
  );
}
