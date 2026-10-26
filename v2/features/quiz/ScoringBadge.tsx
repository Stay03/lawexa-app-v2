import { cn } from '@/lib/utils';
import type { QuizQuestionScoring } from '@/types/channel-quiz';
import { scoringLabel } from './scoring';

/**
 * "Bonus" or "Free point" beside a question that does not count the usual
 * way (`scoring.ts`), and nothing beside an ordinary one. A small gold pill,
 * read with the question's number, so a reader knows before answering
 * whether it counts.
 */
export function ScoringBadge({
  question,
  className,
}: {
  question: { scoring?: QuizQuestionScoring };
  className?: string;
}) {
  const label = scoringLabel(question);
  if (!label) return null;
  return (
    <span
      className={cn(
        // White on gold (the house pair, 4.5:1); gold on a gold tint measured 3.98.
        'inline-flex min-h-5 shrink-0 items-center rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground',
        className,
      )}
    >
      {label}
    </span>
  );
}
