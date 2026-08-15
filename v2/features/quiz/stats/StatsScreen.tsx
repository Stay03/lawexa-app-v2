'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Target, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  isVerificationBlocked,
  metricDuration,
  metricPercent,
  needsEmailVerification,
  readStats,
} from '../model';
import { quizQueries } from '../queries';
import { QuizErrorState } from '../ui/states';
import { VerifyEmailState } from '../ui/VerifyEmailState';
import { StatCard } from './StatCard';
import {
  StatsEmptyState,
  StatsHeading,
  StatsSkeleton,
} from './states';
import { TrendChart } from './TrendChart';

/**
 * StatsScreen — `/quiz/stats`, the student's own progress.
 *
 * ── THE FIX THIS SCREEN EXISTS TO CARRY ─────────────────────────────────────
 * The backend returns `avg_score: 0` and `avg_time_per_question_ms: 0` for an
 * account that has completed nothing (verified live, 2026-08-03) — only
 * `accuracy` and `completion_rate` arrive as `null`. Rendered literally, a
 * brand-new user is told they average 0% and 0 seconds per question, which is
 * both false and discouraging. `readStats` resolves the ambiguity from the
 * COUNTS that produced each mean, so "no data" prints an em dash and a REAL 0%
 * (someone who completed sessions and scored nothing) still prints 0%.
 *
 * ── PRIVATE, AND ONLY HERE ──────────────────────────────────────────────────
 * There is no home strip and no progress module anywhere else: the owner
 * removed the home quiz module in July and it is not coming back through a side
 * door. Stats live at this URL, reachable from the hub and the history page.
 *
 * ── THE CHART NEEDS TWO POINTS TO BE A TREND ────────────────────────────────
 * One finished session is a value, not a direction, so the card says what is
 * missing instead of drawing a single dot and calling it a trend.
 */
export function StatsScreen() {
  const session = useV2Session();
  const { userId: viewerId } = session;

  /**
   * NOTHING IS PUBLISHED TO THE HEADER FROM HERE ANY MORE (phase 7). "Your
   * progress" is a fact about the ADDRESS (`v2/shell/pushed-route.ts`), so the
   * bar carries it on the first frame and in all five of the states below, and
   * `StatsHeading` draws it only from `md:` up, where the bar's title is hidden.
   */

  // Never send a request the snapshot already knows will 403 — see the hub.
  const snapshotUnverified = needsEmailVerification(session);

  const statsQuery = useQuery({
    ...quizQueries.stats({ viewerId }),
    enabled: !snapshotUnverified,
  });

  if (snapshotUnverified || isVerificationBlocked(statsQuery.error)) {
    return (
      <div className={LIST_COLUMN}>
        <StatsHeading />
        <VerifyEmailState />
      </div>
    );
  }

  if (statsQuery.isPending) {
    return (
      <div className={LIST_COLUMN}>
        <StatsHeading />
        <StatsSkeleton />
      </div>
    );
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <div className={LIST_COLUMN}>
        <StatsHeading />
        <QuizErrorState
          title="Couldn't load your progress"
          description="Your sessions are all still recorded — the summary just did not load."
          onRetry={() => void statsQuery.refetch()}
        />
      </div>
    );
  }

  const data = statsQuery.data.data;
  const { sessions, performance, engagement } = data;
  const honest = readStats(data);

  if (honest.isEmpty) {
    return (
      <div className={LIST_COLUMN}>
        <StatsHeading />
        <StatsEmptyState />
      </div>
    );
  }

  const endedTotal = engagement.completed + engagement.auto_abandoned;

  return (
    <div className={LIST_COLUMN}>
      <StatsHeading />

      <div className="flex flex-col gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="Average score"
            value={metricPercent(honest.avgScore)}
            empty={honest.avgScore == null}
            sub={
              engagement.completed > 0
                ? `Across ${engagement.completed} finished ${engagement.completed === 1 ? 'session' : 'sessions'}`
                : 'Finish a session to see this'
            }
          />
          <StatCard
            icon={Target}
            label="Accuracy"
            value={metricPercent(honest.accuracy)}
            empty={honest.accuracy == null}
            sub={
              sessions.answered > 0
                ? `${sessions.correct} of ${sessions.answered} correct`
                : 'Answer a question to see this'
            }
          />
          <StatCard
            icon={CheckCircle2}
            label="Sessions finished"
            value={metricPercent(honest.completionRate)}
            empty={honest.completionRate == null}
            sub={
              endedTotal > 0
                ? `${engagement.completed} of ${endedTotal} ended by you`
                : 'Nothing has ended yet'
            }
          />
          <StatCard
            icon={Clock}
            label="Time per question"
            value={metricDuration(honest.avgTimeMs)}
            empty={honest.avgTimeMs == null}
            sub="While you answer"
          />
        </div>

        <section
          aria-label="Score over time"
          className="rounded-xl border border-border bg-card p-4 sm:p-5"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Score over time
              </h2>
              <p className="text-xs text-muted-foreground">
                {performance.score_trend.length >= 2
                  ? `Your last ${performance.score_trend.length} finished sessions, oldest first.`
                  : 'Your finished sessions, oldest first.'}
              </p>
            </div>
            {/* The endpoint's direct label — selective, and out of the plot so
                it can never collide with a mark or a tooltip. */}
            {performance.score_trend.length >= 2 ? (
              <p className="text-xs text-muted-foreground">
                Latest{' '}
                <span className="font-semibold tabular-nums text-foreground">
                  {Math.round(
                    performance.score_trend[performance.score_trend.length - 1]
                      .score_percentage,
                  )}
                  %
                </span>
              </p>
            ) : null}
          </div>

          {performance.score_trend.length >= 2 ? (
            <TrendChart data={performance.score_trend} />
          ) : (
            <p className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {performance.score_trend.length === 1
                ? 'One finished session so far — finish another and the trend appears here.'
                : 'Finish a couple of sessions and your trend appears here.'}
            </p>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryBlock
            title="Sessions"
            value={String(sessions.total)}
            lines={[
              `${sessions.completed} finished · ${sessions.abandoned} timed out${
                sessions.active > 0 ? ` · ${sessions.active} open` : ''
              }`,
              sessions.last_active_at
                ? `Last active ${formatSessionDate(sessions.last_active_at)}`
                : null,
            ]}
          />
          <SummaryBlock
            title="Questions"
            value={String(sessions.answered)}
            valueAside={`of ${sessions.served} served`}
            lines={[
              `${sessions.correct} correct`,
              // The gap between served and answered is the trailing question of
              // each session — served, then the session ended. Saying so stops
              // it reading as questions the reader skipped.
              sessions.served > sessions.answered
                ? 'The difference is the question left on screen when a session ended.'
                : null,
            ]}
          />
        </div>

        <p className="text-xs text-muted-foreground/80">
          Only you can see this page.{' '}
          <Link
            href="/quiz/history"
            className={cn(
              'v2-interactive rounded-md text-foreground underline-offset-4 transition-colors hover:underline',
              FOCUS_RING,
            )}
          >
            See every session
          </Link>
        </p>
      </div>
    </div>
  );
}

/** A quiet count block — the two totals that need no chart. */
function SummaryBlock({
  title,
  value,
  valueAside,
  lines,
}: {
  title: string;
  value: string;
  valueAside?: string;
  lines: (string | null)[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-2xl font-semibold text-foreground">
        {value}
        {valueAside ? (
          <span className="text-base font-normal text-muted-foreground">
            {' '}
            {valueAside}
          </span>
        ) : null}
      </p>
      {/* Keyed by position: these lines are a fixed, ordered tuple, and two of
          them could legitimately render the same string. */}
      {lines
        .filter((line): line is string => line !== null)
        .map((line, index) => (
          <p key={index} className="mt-1 text-xs text-muted-foreground">
            {line}
          </p>
        ))}
    </div>
  );
}
