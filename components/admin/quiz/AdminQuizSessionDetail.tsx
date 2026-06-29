'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QuizSessionStatusBadge } from '@/components/quiz/QuizSessionStatusBadge';
import { QuizResultsBreakdown } from '@/components/quiz/QuizResultsBreakdown';
import { QuizResultsReview } from '@/components/quiz/QuizResultsReview';
import { useAdminQuizSession } from '@/lib/hooks/useAdminQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import {
  formatDurationMs,
  formatSessionDate,
  parseScore,
  scoreBandClasses,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';

/** Compact score ring with the percentage (or "—" before the first answer). */
function ScoreRing({ percent, hasScore }: { percent: number; hasScore: boolean }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-primary"
          style={{ strokeDasharray: circumference, strokeDashoffset: hasScore ? offset : circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-lg font-bold tabular-nums', scoreBandClasses(percent))}>
          {hasScore ? `${Math.round(percent)}%` : '—'}
        </span>
      </div>
    </div>
  );
}

/** Admin answer-by-answer review of one session (any user, even un-ended). */
export function AdminQuizSessionDetail({ uuid }: { uuid: string }) {
  const query = useAdminQuizSession(uuid);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {query.error
              ? extractApiError(query.error).message
              : 'Session not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { session, questions } = query.data.data;
  const percent = parseScore(session.score_percentage);
  const duration = sessionDurationMs(session.started_at, session.completed_at);

  return (
    <div className="space-y-5">
      <BackLink />

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <ScoreRing percent={percent} hasScore={session.score_percentage != null} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{session.user.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <QuizSessionStatusBadge status={session.status} />
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {session.correct_count}/{session.answered_count} correct
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
            <Meta label="Served" value={String(session.served_count)} />
            <Meta label="Started" value={formatSessionDate(session.started_at)} />
            <Meta
              label="Duration"
              value={duration != null ? formatDurationMs(duration) : '—'}
            />
          </div>
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No answered questions yet.
        </div>
      ) : (
        <>
          <QuizResultsBreakdown questions={questions} />
          <QuizResultsReview questions={questions} />
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
      <Link href="/admin/quiz/sessions">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>
    </Button>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
