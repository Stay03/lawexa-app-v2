'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QuizSessionStatusBadge } from '@/components/quiz/QuizSessionStatusBadge';
import { QuizResultItemCard } from '@/components/quiz/QuizResultItemCard';
import { useAdminQuizSession } from '@/lib/hooks/useAdminQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import {
  formatDurationMs,
  formatScorePercent,
  formatSessionDate,
  parseScore,
  scoreBandClasses,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';

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
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardContent className="flex flex-wrap items-start gap-x-8 gap-y-4 py-5">
          <div>
            <p className="text-xs text-muted-foreground">Score</p>
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                scoreBandClasses(percent)
              )}
            >
              {session.score_percentage == null
                ? '—'
                : formatScorePercent(session.score_percentage)}
            </p>
          </div>
          <Meta label="User" value={session.user.name} />
          <Meta
            label="Status"
            value={<QuizSessionStatusBadge status={session.status} />}
          />
          <Meta
            label="Correct"
            value={`${session.correct_count}/${session.answered_count}`}
          />
          <Meta label="Served" value={String(session.served_count)} />
          <Meta label="Started" value={formatSessionDate(session.started_at)} />
          {duration != null && (
            <Meta label="Duration" value={formatDurationMs(duration)} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Review ({questions.length})
        </h2>
        {questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            No answered questions yet.
          </div>
        ) : (
          questions.map((item, index) => (
            <QuizResultItemCard
              key={`${item.sequence}-${index}`}
              item={item}
              index={index}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/admin/quiz/sessions">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>
    </Button>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
