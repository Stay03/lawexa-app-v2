'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminQuizPeriodSelect } from './AdminQuizPeriodSelect';
import { useAdminQuizBatchSummary } from '@/lib/hooks/useAdminQuiz';
import {
  formatDurationMs,
  formatPeriodWindow,
  formatTokenCost,
} from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';
import type { AdminQuizPeriodParams } from '@/types/admin-quiz';

/** Period-aware generation health: stat cards + content/transcript coverage. */
export function AdminQuizGenerationSummary() {
  const [period, setPeriod] = useState<AdminQuizPeriodParams>({
    period: 'last_30_days',
  });
  const query = useAdminQuizBatchSummary(period);

  const totals = query.data?.data.totals;
  const coverage = query.data?.data.coverage;
  const periodWindow = query.data?.data.period;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <CardTitle>Generation</CardTitle>
          {periodWindow && (
            <p className="text-xs text-muted-foreground">
              {formatPeriodWindow(periodWindow.start, periodWindow.end)}
            </p>
          )}
        </div>
        <AdminQuizPeriodSelect value={period} onChange={setPeriod} />
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-xl" />
            ))}
          </div>
        ) : query.isError || !totals ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load the generation summary.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Batches" value={totals.batches.toLocaleString()} />
              <Stat label="Success rate" value={`${Math.round(totals.success_rate)}%`} />
              <Stat label="Questions" value={totals.questions_generated.toLocaleString()} />
              <Stat label="Stuck now" value={totals.stuck_now.toLocaleString()} warn={totals.stuck_now > 0} />
              <Stat label="Tokens" value={totals.total_tokens.toLocaleString()} />
              <Stat label="Cost" value={formatTokenCost(totals.total_cost)} />
              <Stat label="Avg duration" value={formatDurationMs(totals.avg_duration_ms)} />
              <Stat label="Failed" value={totals.failed.toLocaleString()} warn={totals.failed > 0} />
            </div>
            {coverage && (
              <CoverageBar
                content={coverage.content}
                transcript={coverage.transcript}
                ratio={coverage.content_ratio}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums',
          warn && 'text-amber-600 dark:text-amber-400'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CoverageBar({
  content,
  transcript,
  ratio,
}: {
  content: number;
  transcript: number;
  ratio: number;
}) {
  const total = content + transcript;
  const contentPct = total > 0 ? (content / total) * 100 : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Coverage</span>
        <span>{Math.round(ratio)}% content-grounded</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-primary" style={{ width: `${contentPct}%` }} />
      </div>
      <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{content}</span> content
        </span>
        <span>
          <span className="font-medium text-foreground">{transcript}</span> transcript
        </span>
      </div>
    </div>
  );
}
