'use client';

import Link from 'next/link';
import { BarChart3, CheckCircle2, Clock, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuizStats } from '@/lib/hooks/useQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import {
  formatDurationMs,
  formatSessionDate,
  scoreBandClasses,
} from '@/lib/utils/quiz-format';
import { QuizStatCard } from './QuizStatCard';
import { QuizScoreTrendChart } from './QuizScoreTrendChart';
import { QuizMessage } from './QuizMessage';

/** Render a plain-number percentage, or "—" when null. */
function pct(n: number | null): string {
  return n == null ? '—' : `${Math.round(n)}%`;
}

export function QuizStats() {
  const statsQuery = useQuizStats();

  if (statsQuery.isLoading) return <QuizStatsSkeleton />;

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <QuizMessage
        icon={<BarChart3 className="h-7 w-7" />}
        title="We couldn't load your stats"
        description={
          statsQuery.error
            ? extractApiError(statsQuery.error).message
            : 'Please try again.'
        }
        action={<Button onClick={() => statsQuery.refetch()}>Try again</Button>}
      />
    );
  }

  const { sessions, performance, engagement } = statsQuery.data.data;

  if (sessions.total === 0) {
    return (
      <QuizMessage
        icon={<BarChart3 className="h-7 w-7" />}
        title="No stats yet"
        description="Finish a quiz session and your progress shows up here."
        action={
          <Button asChild>
            <Link href="/quiz">Start practising</Link>
          </Button>
        }
      />
    );
  }

  const engagementTotal = engagement.completed + engagement.auto_abandoned;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-8 animate-in fade-in duration-300 motion-reduce:animate-none">
      <div>
        <h1 className="text-xl font-semibold">Your progress</h1>
        <p className="text-sm text-muted-foreground">
          Practice stats across all your sessions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuizStatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg score"
          value={pct(performance.avg_score)}
          valueClassName={
            performance.avg_score != null
              ? scoreBandClasses(performance.avg_score)
              : undefined
          }
        />
        <QuizStatCard
          icon={<Target className="h-4 w-4" />}
          label="Accuracy"
          value={pct(performance.accuracy)}
          valueClassName={
            performance.accuracy != null
              ? scoreBandClasses(performance.accuracy)
              : undefined
          }
          sub={`${sessions.correct}/${sessions.answered} correct`}
        />
        <QuizStatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completion"
          value={pct(engagement.completion_rate)}
          sub={engagementTotal > 0 ? `${engagement.completed} of ${engagementTotal}` : undefined}
        />
        <QuizStatCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg time"
          value={
            performance.avg_time_per_question_ms == null
              ? '—'
              : formatDurationMs(performance.avg_time_per_question_ms)
          }
          sub="per question"
        />
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Score over time</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Your last {performance.score_trend.length} ended sessions.
        </p>
        {performance.score_trend.length >= 2 ? (
          <QuizScoreTrendChart data={performance.score_trend} />
        ) : (
          <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
            Finish a couple of sessions to see your trend.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Sessions</h2>
          <p className="mt-2 text-2xl font-bold tabular-nums">{sessions.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sessions.completed} completed · {sessions.abandoned} abandoned
            {sessions.active > 0 ? ` · ${sessions.active} in progress` : ''}
          </p>
          {sessions.last_active_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last active {formatSessionDate(sessions.last_active_at)}
            </p>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Questions</h2>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {sessions.answered}
            <span className="text-base font-normal text-muted-foreground">
              {' '}
              / {sessions.served} answered
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sessions.correct} correct
          </p>
        </div>
      </div>
    </div>
  );
}

function QuizStatsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}
