'use client';

import { cn } from '@/lib/utils';
import {
  formatScorePercent,
  parseScore,
  scoreBandClasses,
} from '@/lib/utils/quiz-format';

interface QuizScoreChipProps {
  correct: number;
  answered: number;
  scorePercentage: string | null;
  className?: string;
}

/** Live score pill: "2/6 · 33%", banded by score. Announces changes politely. */
export function QuizScoreChip({
  correct,
  answered,
  scorePercentage,
  className,
}: QuizScoreChipProps) {
  const hasAnswers = answered > 0;
  const percent = parseScore(scorePercentage);

  return (
    <div
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs tabular-nums',
        className
      )}
    >
      {hasAnswers ? (
        <>
          <span className="text-muted-foreground">
            {correct}/{answered}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className={cn('font-semibold', scoreBandClasses(percent))}>
            {formatScorePercent(scorePercentage)}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">No answers yet</span>
      )}
    </div>
  );
}
