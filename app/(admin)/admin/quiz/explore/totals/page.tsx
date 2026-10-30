'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Gamepad2, PencilRuler, Percent, Play, Sparkles, TriangleAlert, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminQuizStatCard } from '@/components/admin/quiz/AdminQuizStatCard';
import { AdminChannelQuizError } from '@/components/admin/channel-quiz/AdminChannelQuizStates';
import { AdminChannelQuizTotalsChart } from '@/components/admin/channel-quiz/AdminChannelQuizTotalsChart';
import { EXPLORE_BASE, nextSearch, percentLabel } from '@/components/admin/channel-quiz/model';
import { useAdminChannelQuizTotals } from '@/lib/hooks/useAdminChannelQuizzes';
import { formatPeriodWindow } from '@/lib/utils/quiz-format';

const TOTALS_PATH = `${EXPLORE_BASE}/totals`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Explore quizzes (new) › Totals: the range's numbers and its plays per day (the last 30 days unless set). */
export default function AdminExploreTotalsPage() {
  return (
    <Suspense fallback={null}>
      <AdminExploreTotalsContent />
    </Suspense>
  );
}

function AdminExploreTotalsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => {
    const from = searchParams.get('date_from');
    const to = searchParams.get('date_to');
    return {
      ...(from && DAY.test(from) ? { date_from: from } : {}),
      ...(to && DAY.test(to) ? { date_to: to } : {}),
    };
  }, [searchParams]);
  const query = useAdminChannelQuizTotals(params);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const qs = nextSearch(new URLSearchParams(searchParams.toString()), updates, false);
      router.push(qs ? `${TOTALS_PATH}?${qs}` : TOTALS_PATH);
    },
    [router, searchParams],
  );

  const totals = query.data?.data;
  const runs = totals?.create_with_lawexa;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Totals</CardTitle>
          <CardDescription>{totals ? formatPeriodWindow(totals.date_from, totals.date_to) : 'The last 30 days'}</CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="date"
            aria-label="From"
            className="h-9 w-full sm:w-[150px]"
            value={params.date_from ?? ''}
            onChange={(e) => updateParams({ date_from: e.target.value || undefined })}
          />
          <Input
            type="date"
            aria-label="To"
            className="h-9 w-full sm:w-[150px]"
            value={params.date_to ?? ''}
            onChange={(e) => updateParams({ date_to: e.target.value || undefined })}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {query.isError ? (
          <AdminChannelQuizError error={query.error} onRetry={() => void query.refetch()} />
        ) : !totals ? (
          <TotalsSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <AdminQuizStatCard label="Plays" value={String(totals.plays)} icon={Play} changePercent={null} />
              <AdminQuizStatCard label="Finished" value={percentLabel(totals.completion_rate)} icon={CheckCircle2} changePercent={null} />
              <AdminQuizStatCard label="Players" value={String(totals.players)} icon={Users} changePercent={null} />
              <AdminQuizStatCard label="Average score" value={percentLabel(totals.average_score_percent)} icon={Percent} changePercent={null} />
              <AdminQuizStatCard label="Quizzes made" value={String(totals.quizzes_created)} icon={PencilRuler} changePercent={null} />
              <AdminQuizStatCard label="Live games finished" value={String(totals.live_games_finished)} icon={Gamepad2} changePercent={null} />
              <AdminQuizStatCard label="Create with Lawexa: done" value={String(runs?.done ?? 0)} icon={Sparkles} changePercent={null} />
              <AdminQuizStatCard
                label="Create with Lawexa: failed"
                value={String(runs?.failed ?? 0)}
                icon={TriangleAlert}
                changePercent={null}
              />
            </div>
            {runs && runs.reading + runs.writing > 0 ? (
              <p className="text-xs text-muted-foreground">
                Create with Lawexa still running: {runs.reading} reading, {runs.writing} writing.
              </p>
            ) : null}
            <div>
              <h3 className="mb-2 text-sm font-medium">Plays per day</h3>
              <AdminChannelQuizTotalsChart days={totals.by_day} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TotalsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[260px] w-full rounded-lg" />
    </div>
  );
}
