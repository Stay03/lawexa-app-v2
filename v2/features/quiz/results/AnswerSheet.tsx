'use client';

import { cn } from '@/lib/utils';
import type { QuizResultItem } from '@/types/quiz';

/**
 * AnswerSheet — one cell per answered question, correct or not, in order.
 *
 * WHY IT EXISTS. Sessions are endless: six questions or two hundred, the review
 * has to stay one screen tall and stay scannable. This grid is the whole
 * session at a glance AND the random-access control for the stepper beside it —
 * tap a cell to open that question. Without it, a long review is a scroll
 * through a hundred cards with no map.
 *
 * ── IT DENSIFIES INSTEAD OF WRAPPING FOREVER ────────────────────────────────
 * Past {@link DENSE_ABOVE} answers the number inside each cell stops earning
 * its space, so the cells drop their labels AND shrink — one threshold for
 * both. Two thresholds (drop digits at 100, shrink at 120) produced a 101–120
 * band of full-size BLANK cells, which reads as a rendering fault rather than a
 * density choice. The `aria-label` keeps the position and the verdict on every
 * cell at every size, so nothing is lost — only the printed digit goes.
 *
 * ── NEVER COLOUR-ALONE ──────────────────────────────────────────────────────
 * The tint is the fast read, but every cell names its verdict in its accessible
 * label, the legend spells both out in words, and the current cell is marked
 * with an OUTLINE (a shape difference) rather than a third colour.
 */
/** Above this many answers the grid goes label-less AND small, together. */
const DENSE_ABOVE = 100;

export function AnswerSheet({
  questions,
  currentIndex,
  onJump,
}: {
  questions: QuizResultItem[];
  /** 0-based index of the question open in the stepper. */
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const dense = questions.length > DENSE_ABOVE;
  const showNumber = !dense;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Answer sheet</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 rounded-sm bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/40"
            />
            Correct
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3 rounded-sm bg-destructive/15 ring-1 ring-inset ring-destructive/40"
            />
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
              aria-label={`Question ${index + 1}, ${item.was_correct ? 'correct' : 'incorrect'}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={cn(
                'v2-interactive flex items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ring-1 ring-inset transition-transform',
                'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                dense ? 'size-5' : 'size-7',
                item.was_correct
                  ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400'
                  : 'bg-destructive/15 text-destructive ring-destructive/30',
                isCurrent && 'outline outline-2 outline-offset-1 outline-foreground',
              )}
            >
              <span aria-hidden>{showNumber ? index + 1 : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
