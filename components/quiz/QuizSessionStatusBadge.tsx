import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { sessionStatusMeta } from '@/lib/utils/quiz-format';
import type { QuizSessionStatus } from '@/types/quiz';

interface QuizSessionStatusBadgeProps {
  status: QuizSessionStatus;
  className?: string;
}

/** Small pill for a session's lifecycle state (In progress / Completed / Abandoned). */
export function QuizSessionStatusBadge({
  status,
  className,
}: QuizSessionStatusBadgeProps) {
  const { label, classes } = sessionStatusMeta(status);
  return (
    <Badge variant="outline" className={cn('border-transparent', classes, className)}>
      {label}
    </Badge>
  );
}
