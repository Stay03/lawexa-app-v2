'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, GraduationCap, Play, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatScorePercent } from '@/lib/utils/quiz-format';
import { quizQueries } from '@/v2/features/quiz/queries';
import type { QuizStatsData } from '@/types/quiz';
import { FOCUS_RING, ModuleCard, ModuleError } from './parts';

/**
 * QuizModule — the Study tab's Quiz surface (owner #34). Three honest reads from
 * `quizQueries`, wired to the REAL v1 player routes:
 *
 *  - the active-session PEEK → a "Continue your quiz" card (progress + resume) to
 *    `/quiz/play?s={uuid}` when an open session exists, else a "Start practice"
 *    row to `/quiz` (research: "continue where you left off" is the #1 motivator);
 *  - the shipped stats endpoint → a compact accuracy / answered / avg-score strip
 *    (the shape carries no streak, so none is invented — real numbers only);
 *  - recent topics → quiet chips that jump to the quiz start (where v1's real
 *    topic picker lives).
 *
 * ROLE GATE: this module is rendered by StudyHome only for the quiz soft-launch
 * audience (`canAccessQuizPlayer`), so it fetches on mount without an extra
 * enabled flag — mirroring v1's rule from the threaded role, not a v1 hook.
 *
 * Each read owns its own skeleton → content cross-fade and a distinct error
 * (never error-as-empty). The active-session peek is the primary read; its
 * failure is the module's error. The stats strip and topics are supplementary,
 * so their loading/error stays scoped to their own row.
 */

/** Format a numeric stat aggregate as a rounded %, or an em dash before data. */
function formatPercentStat(value: number | null): string {
  return value == null ? '—' : `${Math.round(value)}%`;
}

export function QuizModule() {
  const peekQuery = useQuery(quizQueries.activeSessionPeek());
  const statsQuery = useQuery(quizQueries.stats());
  const topicsQuery = useQuery(quizQueries.topics());

  const activeSession =
    peekQuery.data?.data?.find((s) => s.status === 'active') ?? null;
  const topics = (topicsQuery.data?.data ?? []).slice(0, 6);

  return (
    <ModuleCard
      title="Quiz"
      icon={GraduationCap}
      action={{ label: 'Stats', href: '/quiz/stats' }}
    >
      <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
        {/* Primary block — continue an open session, or start a new one. The peek
            failure is the module's error (retryable in place). */}
        {peekQuery.isError ? (
          <ModuleError onRetry={() => peekQuery.refetch()}>
            Couldn&apos;t load your quiz.
          </ModuleError>
        ) : peekQuery.isPending ? (
          <div
            className="h-[4.25rem] w-full rounded-xl bg-muted motion-safe:animate-pulse"
            aria-hidden
          />
        ) : activeSession ? (
          <Link
            href={`/quiz/play?s=${activeSession.uuid}`}
            className={cn(
              'group flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 transition-colors hover:border-primary/50 hover:bg-primary/10',
              FOCUS_RING,
            )}
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <RotateCcw className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                Continue your quiz
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {activeSession.answered_count > 0
                  ? `${activeSession.answered_count} answered · ${formatScorePercent(activeSession.score_percentage)}`
                  : 'Pick up where you left off'}
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ) : (
          <Link
            href="/quiz"
            className={cn(
              'group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-secondary/40',
              FOCUS_RING,
            )}
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Play className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                Start a practice session
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Multiple-choice questions from your study topics
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </Link>
        )}

        {/* Progress strip — supplementary; its own loading / error, scoped small. */}
        <StatsStrip
          data={statsQuery.data?.data}
          isPending={statsQuery.isPending}
          isError={statsQuery.isError}
          onRetry={() => statsQuery.refetch()}
        />

        {/* Recent topics — quiet chips to the quiz start (v1's real topic picker
            lives there). Shown only once resolved with topics; otherwise absent
            (a supplementary affordance never shows an error/empty of its own). */}
        {topics.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Recent topics
            </span>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => (
                <Link
                  key={topic.topic_key}
                  href="/quiz"
                  className={cn(
                    'v2-interactive inline-flex min-h-11 max-w-full items-center truncate rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-foreground md:min-h-8',
                    FOCUS_RING,
                  )}
                  title={topic.topic}
                >
                  {topic.topic}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ModuleCard>
  );
}

/**
 * The three-up progress strip. Numbers are the shipped stats aggregates (plain
 * numbers, not string-decimals); rate fields can be null before there is enough
 * data, so they render an em dash rather than a misleading 0%.
 */
function StatsStrip({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: QuizStatsData | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 rounded-xl bg-muted motion-safe:animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'v2-interactive rounded-xl border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          FOCUS_RING,
        )}
      >
        Couldn&apos;t load stats · Try again
      </button>
    );
  }

  const cells = [
    { label: 'Accuracy', value: formatPercentStat(data.performance.accuracy) },
    { label: 'Answered', value: data.sessions.answered.toLocaleString() },
    { label: 'Avg score', value: formatPercentStat(data.performance.avg_score) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-col items-center justify-center rounded-xl bg-secondary/50 px-2 py-2.5 text-center"
        >
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {cell.value}
          </span>
          <span className="text-[11px] text-muted-foreground">{cell.label}</span>
        </div>
      ))}
    </div>
  );
}
