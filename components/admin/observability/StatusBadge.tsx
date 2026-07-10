import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StatusMeta, StatusTone } from '@/lib/utils/observability';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-transparent bg-muted text-muted-foreground',
  info: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  success:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning:
    'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20',
};

interface StatusBadgeProps {
  meta: StatusMeta;
  className?: string;
}

/** Tone-coloured status pill for job rows, driven by a resolved StatusMeta. */
export function StatusBadge({ meta, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 font-medium', TONE_CLASSES[meta.tone], className)}
    >
      {meta.spinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {meta.label}
    </Badge>
  );
}
