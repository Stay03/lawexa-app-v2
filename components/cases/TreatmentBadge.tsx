import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatTreatment, type TreatmentTone } from '@/lib/utils/related-cases';

interface TreatmentBadgeProps {
  treatment: string | null;
  className?: string;
}

const TONE_CLASSES: Record<TreatmentTone, string> = {
  neutral: 'border-transparent bg-muted text-muted-foreground',
  caution:
    'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  negative:
    'border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20',
};

/**
 * Compact badge describing how a case treated a cited authority
 * (e.g. "Followed", "Distinguished", "Overruled"). Renders nothing when the
 * treatment is absent or unrecognized-as-empty.
 */
function TreatmentBadge({ treatment, className }: TreatmentBadgeProps) {
  const meta = formatTreatment(treatment);
  if (!meta) return null;

  return (
    <Badge
      variant="outline"
      className={cn('h-5 px-1.5 text-[10px] font-medium', TONE_CLASSES[meta.tone], className)}
    >
      {meta.label}
    </Badge>
  );
}

export { TreatmentBadge };
