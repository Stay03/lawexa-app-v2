import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QuizBatchStatus } from '@/types/admin-quiz';

const META: Record<QuizBatchStatus, { label: string; classes: string }> = {
  queued: { label: 'Queued', classes: 'bg-muted text-muted-foreground' },
  running: {
    label: 'Running',
    classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  failed: { label: 'Failed', classes: 'bg-destructive/10 text-destructive' },
  skipped: {
    label: 'Skipped',
    classes: 'bg-muted text-muted-foreground',
  },
};

export function AdminQuizBatchStatusBadge({
  status,
  className,
}: {
  status: QuizBatchStatus;
  className?: string;
}) {
  const meta = META[status];
  return (
    <Badge variant="outline" className={cn('border-transparent', meta.classes, className)}>
      {meta.label}
    </Badge>
  );
}
