import { cn } from '@/lib/utils';
import type { QuizDifficulty } from '@/types/quiz';
import {
  DIFFICULTY_SCALE,
  difficultyDescription,
} from '@/v2/features/quiz/model';

/**
 * DifficultyBadge — a question's difficulty as a WORD plus a five-step ordinal
 * meter.
 *
 * WHY NOT v1's TRAFFIC LIGHT. v1 coloured this green / amber / red
 * (`difficultyBadgeClasses`). Difficulty is an ORDERED scale, not a status: a
 * hard question is not a warning and an easy one is not a success, so borrowing
 * the status palette says something the data does not (and spends the reserved
 * good/bad channel on it — see the dataviz rule that status colours are
 * reserved). The v2 badge encodes the order the way an ordered scale should be
 * encoded: filled steps, one hue, more-is-more. Colour adds nothing the meter
 * and the label do not already carry, so it adds none.
 *
 * The meter is `aria-hidden` — the accessible name spells the level out in
 * words, so a screen reader hears "Easy — level 2 of 5" rather than five dots.
 */
export function DifficultyBadge({
  difficulty,
  label,
  className,
}: {
  difficulty: QuizDifficulty;
  label: string;
  className?: string;
}) {
  const description = difficultyDescription(difficulty, label);

  return (
    <span
      title={description}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      <span className="sr-only">{description}</span>
      <span aria-hidden>{label}</span>
      <span aria-hidden className="flex items-center gap-[2px]">
        {DIFFICULTY_SCALE.map((step) => (
          <span
            key={step}
            className={cn(
              'h-2.5 w-[3px] rounded-full',
              step <= difficulty ? 'bg-foreground/60' : 'bg-foreground/15',
            )}
          />
        ))}
      </span>
    </span>
  );
}
