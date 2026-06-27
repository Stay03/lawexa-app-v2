import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { difficultyBadgeClasses } from '@/lib/utils/quiz-format';
import type { QuizDifficulty } from '@/types/quiz';

interface DifficultyBadgeProps {
  difficulty: QuizDifficulty;
  label: string;
  className?: string;
}

/** A small pill showing a question's difficulty, colour-coded by level. */
export function DifficultyBadge({ difficulty, label, className }: DifficultyBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent', difficultyBadgeClasses(difficulty), className)}
    >
      {label}
    </Badge>
  );
}
