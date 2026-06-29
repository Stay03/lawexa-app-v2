'use client';

import Link from 'next/link';
import { Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatDurationMs,
  formatSessionDate,
  parseScore,
  scoreBandClasses,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';
import type { QuizSession } from '@/types/quiz';

interface QuizResultsSummaryProps {
  session: QuizSession;
  /** Mean answer time across the session, in ms (0 if unknown). */
  avgTimeMs: number;
}

/** Circular score ring with the percentage in the middle. */
function ScoreRing({ percent }: { percent: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-primary"
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-3xl font-bold tabular-nums', scoreBandClasses(percent))}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

/** Compact hero card: score ring + headline + at-a-glance chips + follow-up actions. */
export function QuizResultsSummary({ session, avgTimeMs }: QuizResultsSummaryProps) {
  const percent = parseScore(session.score_percentage);
  const date = session.completed_at ? formatSessionDate(session.completed_at) : null;
  const duration = sessionDurationMs(session.started_at, session.completed_at);
  const correct = session.correct_count;
  const answered = session.answered_count;
  const incorrect = Math.max(0, answered - correct);

  const timing = [
    duration ? formatDurationMs(duration) : null,
    avgTimeMs > 0 ? `~${formatDurationMs(avgTimeMs)}/question` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-2xl border bg-card p-6 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:text-left">
        <ScoreRing percent={percent} />

        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-xl font-semibold">Session complete</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {correct} of {answered} correct{date ? ` · ${date}` : ''}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {correct} correct
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
              <X className="h-3.5 w-3.5" />
              {incorrect} incorrect
            </span>
            {timing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {timing}
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
          <Button asChild className="flex-1">
            <Link href="/quiz">Practice again</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/quiz/history">View history</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
