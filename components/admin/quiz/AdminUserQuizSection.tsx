'use client';

import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  GraduationCap,
  Layers,
  Sparkles,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QuizStatCard } from '@/components/quiz/QuizStatCard';
import { UserScoreSparkline } from './UserScoreSparkline';
import { useAdminUserQuizProfile } from '@/lib/hooks/useAdminQuiz';
import {
  formatDurationMs,
  formatSessionDate,
  formatTokenCost,
  scoreBandClasses,
} from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';
import type { AdminUserQuizProfile } from '@/types/admin-quiz';

/** "Quiz activity" card on the admin user-detail page. Self-fetches by uuid. */
export function AdminUserQuizSection({ uuid }: { uuid: string }) {
  const query = useAdminUserQuizProfile(uuid);
  const profile = query.data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-4 w-4" />
          Quiz activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <QuizSectionSkeleton />
        ) : query.isError || !profile ? (
          <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
            Failed to load quiz activity. Please try again.
          </div>
        ) : profile.sessions.total === 0 && profile.generation.batches === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No quiz activity yet.
          </div>
        ) : (
          <QuizProfile profile={profile} />
        )}
      </CardContent>
    </Card>
  );
}

function QuizProfile({ profile }: { profile: AdminUserQuizProfile }) {
  const { sessions, performance, generation, topics_quizzed } = profile;

  const avgScore = performance.avg_score;
  const accuracy =
    sessions.answered > 0
      ? Math.round((sessions.correct / sessions.answered) * 100)
      : null;
  const completion =
    sessions.total > 0
      ? Math.round((sessions.completed / sessions.total) * 100)
      : null;

  return (
    <div className="space-y-5">
      {/* Performance headline — zero-value session counts fold into the caption */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 className="text-sm font-medium">Performance</h3>
          <p className="text-xs text-muted-foreground">
            {sessions.completed} completed · {sessions.abandoned} abandoned ·{' '}
            {sessions.active} active
            {sessions.last_active_at
              ? ` · last active ${formatSessionDate(sessions.last_active_at)}`
              : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <QuizStatCard
            icon={<Layers className="h-4 w-4" />}
            label="Sessions"
            value={sessions.total.toLocaleString()}
          />
          <QuizStatCard
            icon={<Target className="h-4 w-4" />}
            label="Accuracy"
            value={accuracy == null ? '—' : `${accuracy}%`}
            sub={`${sessions.correct}/${sessions.answered} correct`}
          />
          <QuizStatCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Avg score"
            value={avgScore == null ? '—' : `${Math.round(avgScore)}%`}
            valueClassName={
              avgScore == null ? undefined : scoreBandClasses(avgScore)
            }
          />
          <QuizStatCard
            icon={<Clock className="h-4 w-4" />}
            label="Avg time / q"
            value={
              performance.avg_time_per_question_ms == null
                ? '—'
                : formatDurationMs(performance.avg_time_per_question_ms)
            }
          />
          <QuizStatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Completion"
            value={completion == null ? '—' : `${completion}%`}
          />
        </div>
      </section>

      {/* Score over time */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <p className="text-xs font-medium text-muted-foreground">Score over time</p>
        {performance.score_trend.length >= 2 ? (
          <div className="mt-2">
            <UserScoreSparkline data={performance.score_trend} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Not enough completed sessions for a trend.
          </p>
        )}
      </div>

      {/* Generation details — collapsed by default (admin cost detail, not engagement) */}
      <details className="group rounded-2xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium sm:p-5 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
          Generation details
          <span className="ml-1 font-normal text-muted-foreground">
            {generation.questions.toLocaleString()} questions · {generation.batches}{' '}
            batches · {formatTokenCost(generation.total_cost)}
          </span>
        </summary>
        <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <QuizStatCard
              icon={<Sparkles className="h-4 w-4" />}
              label="Questions"
              value={generation.questions.toLocaleString()}
            />
            <QuizStatCard
              icon={<Layers className="h-4 w-4" />}
              label="Batches"
              value={generation.batches.toLocaleString()}
              sub={`${generation.completed_batches} completed · ${generation.failed_batches} failed`}
            />
            <QuizStatCard
              icon={<Coins className="h-4 w-4" />}
              label="Total cost"
              value={formatTokenCost(generation.total_cost)}
              valueClassName="font-mono"
            />
            <QuizStatCard
              icon={<BookOpen className="h-4 w-4" />}
              label="Topics"
              value={topics_quizzed.distinct.toLocaleString()}
            />
          </div>
          {generation.topics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {generation.topics.map((topic) => (
                <Badge key={topic} variant="secondary" className="font-normal">
                  {topic}
                </Badge>
              ))}
              {topics_quizzed.reached_via_cross_user && (
                <Badge
                  variant="outline"
                  className={cn(
                    'border-transparent',
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  Reached via cross-user
                </Badge>
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function QuizSectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[120px] rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
