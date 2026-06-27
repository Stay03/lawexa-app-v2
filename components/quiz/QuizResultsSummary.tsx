'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  formatSessionDate,
  parseScore,
  scoreBandClasses,
} from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';
import type { QuizSession } from '@/types/quiz';

interface QuizResultsSummaryProps {
  session: QuizSession;
}

/** Circular score ring with the percentage in the middle. */
function ScoreRing({ percent }: { percent: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="relative h-32 w-32">
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

/** Score ring + headline + meta + the two follow-up actions. */
export function QuizResultsSummary({ session }: QuizResultsSummaryProps) {
  const percent = parseScore(session.score_percentage);
  const date = session.completed_at ? formatSessionDate(session.completed_at) : null;

  return (
    <div className="flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
      <ScoreRing percent={percent} />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Session complete</h1>
        <p className="text-sm text-muted-foreground">
          {session.correct_count} of {session.answered_count} correct
          {date ? ` · ${date}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/quiz">Practice again</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Done</Link>
        </Button>
      </div>
    </div>
  );
}
