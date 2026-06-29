'use client';

import { cn } from '@/lib/utils';
import type { QuizResultItem } from '@/types/quiz';

interface QuizResultsAnswerSheetProps {
  questions: QuizResultItem[];
  /** Index (0-based) of the question currently open in the stepper. */
  currentIndex: number;
  onJump: (index: number) => void;
}

/**
 * A compact green/red grid — one cell per answered question. The fixed-size
 * overview that lets the results screen scale from 6 to 200 questions: it shows
 * the whole performance at a glance and gives random access (tap a cell to open
 * that question in the stepper). Numbers are dropped past 100 to stay dense.
 */
export function QuizResultsAnswerSheet({
  questions,
  currentIndex,
  onJump,
}: QuizResultsAnswerSheetProps) {
  const showNumber = questions.length <= 100;
  const dense = questions.length > 120;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Answer sheet
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/40" />
            Correct
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-destructive/15 ring-1 ring-inset ring-destructive/40" />
            Incorrect
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {questions.map((item, index) => {
          const isCurrent = index === currentIndex;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-label={`Question ${index + 1} — ${item.was_correct ? 'correct' : 'incorrect'}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={cn(
                'flex items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ring-1 ring-inset transition-transform',
                'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                dense ? 'h-5 w-5' : 'h-7 w-7',
                item.was_correct
                  ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400'
                  : 'bg-destructive/15 text-destructive ring-destructive/30',
                isCurrent && 'outline outline-2 outline-offset-1 outline-foreground'
              )}
            >
              {showNumber ? index + 1 : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
