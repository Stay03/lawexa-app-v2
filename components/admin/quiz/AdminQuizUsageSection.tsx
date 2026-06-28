'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  Users,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminQuizStatCard } from './AdminQuizStatCard';
import { AdminQuizSessionsChart } from './AdminQuizSessionsChart';
import { AdminQuizAvgScoreChart } from './AdminQuizAvgScoreChart';
import { AdminQuizTopTopicsTable } from './AdminQuizTopTopicsTable';
import { AdminQuizScoreDistribution } from './AdminQuizScoreDistribution';
import { useAdminQuizAnalytics } from '@/lib/hooks/useAdminQuiz';
import { formatDurationMs, formatPeriodWindow } from '@/lib/utils/quiz-format';
import type {
  AdminQuizAnalytics,
  AdminQuizPeriodParams,
} from '@/types/admin-quiz';

interface StatCardDescriptor {
  key: keyof AdminQuizAnalytics['stat_cards'];
  label: string;
  icon: LucideIcon;
  format: (v: number) => string;
}

const STAT_CARDS: StatCardDescriptor[] = [
  { key: 'sessions_started', label: 'Sessions', icon: Activity, format: (v) => v.toLocaleString() },
  { key: 'active_users', label: 'Active users', icon: Users, format: (v) => v.toLocaleString() },
  { key: 'completed_sessions', label: 'Completed', icon: CheckCircle2, format: (v) => v.toLocaleString() },
  { key: 'abandoned_sessions', label: 'Abandoned', icon: XCircle, format: (v) => v.toLocaleString() },
  { key: 'completion_rate', label: 'Completion', icon: Gauge, format: (v) => `${Math.round(v)}%` },
  { key: 'avg_score', label: 'Avg score', icon: BarChart3, format: (v) => `${Math.round(v)}%` },
  { key: 'avg_time_per_question_ms', label: 'Avg time / q', icon: Clock, format: (v) => formatDurationMs(v) },
];

/** Usage dashboard: stat cards (with deltas) + two charts + two tables. */
export function AdminQuizUsageSection({
  params,
}: {
  params: AdminQuizPeriodParams;
}) {
  const query = useAdminQuizAnalytics(params);
  const analytics = query.data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        {analytics && (
          <p className="text-xs text-muted-foreground">
            {formatPeriodWindow(analytics.period.start, analytics.period.end)} ·
            vs{' '}
            {formatPeriodWindow(
              analytics.period.comparison_start,
              analytics.period.comparison_end
            )}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {query.isLoading ? (
          <UsageSkeleton />
        ) : query.isError || !analytics ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load the usage analytics.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STAT_CARDS.map((card) => {
                const stat = analytics.stat_cards[card.key];
                return (
                  <AdminQuizStatCard
                    key={card.key}
                    label={card.label}
                    value={card.format(stat.value)}
                    icon={card.icon}
                    changePercent={stat.change_percent}
                  />
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Sessions over time">
                <div className="rounded-xl border p-3">
                  <AdminQuizSessionsChart
                    data={analytics.charts.sessions_over_time}
                    granularity={analytics.granularity}
                  />
                </div>
              </Panel>
              <Panel title="Average score over time">
                <div className="rounded-xl border p-3">
                  <AdminQuizAvgScoreChart
                    data={analytics.charts.avg_score_over_time}
                    granularity={analytics.granularity}
                  />
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Top topics">
                <AdminQuizTopTopicsTable data={analytics.tables.top_topics} />
              </Panel>
              <Panel title="Score distribution">
                <AdminQuizScoreDistribution
                  data={analytics.tables.score_distribution}
                />
              </Panel>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[288px] rounded-xl" />
        <Skeleton className="h-[288px] rounded-xl" />
      </div>
    </div>
  );
}
