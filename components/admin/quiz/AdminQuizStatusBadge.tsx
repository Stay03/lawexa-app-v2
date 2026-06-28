import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QuizQuestionStatus } from '@/types/admin-quiz';

interface AdminQuizStatusBadgeProps {
  status: QuizQuestionStatus;
  deleted?: boolean;
  className?: string;
}

/** Status pill: Approved / Archived, or a "Deleted" override for soft-deleted rows. */
export function AdminQuizStatusBadge({
  status,
  deleted,
  className,
}: AdminQuizStatusBadgeProps) {
  if (deleted) {
    return (
      <Badge
        variant="outline"
        className={cn('border-transparent bg-destructive/10 text-destructive', className)}
      >
        Deleted
      </Badge>
    );
  }

  return status === 'approved' ? (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        className
      )}
    >
      Approved
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className={cn('border-transparent bg-muted text-muted-foreground', className)}
    >
      Archived
    </Badge>
  );
}
