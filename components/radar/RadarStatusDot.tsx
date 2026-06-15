import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RadarStatus } from '@/types/radar';

const STATUS_CONFIG: Record<RadarStatus, { label: string; dotClass: string }> = {
  active: { label: 'Active', dotClass: 'bg-emerald-500' },
  paused: { label: 'Paused', dotClass: 'bg-amber-500' },
  archived: { label: 'Archived', dotClass: 'bg-muted-foreground/50' },
};

interface RadarStatusDotProps {
  status: RadarStatus;
  /** Extra classes for the trigger — e.g. `relative z-10` to sit above a card's link overlay. */
  className?: string;
}

/**
 * Compact status indicator: a colored dot whose meaning is exposed on hover
 * (tooltip) and to assistive tech (aria-label). Replaces the old pill so the
 * status sits in one fixed place — before the title — regardless of length.
 */
function RadarStatusDot({ status, className }: RadarStatusDotProps) {
  const { label, dotClass } = STATUS_CONFIG[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex shrink-0 items-center', className)}
          aria-label={`Status: ${label}`}
        >
          <span className={cn('size-2 rounded-full', dotClass)} aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { RadarStatusDot };
