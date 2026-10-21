import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * SummaryChip — one fact on a results headline ("3 correct", "~12s per
 * question"), icon AND word, never colour alone. Shared by the practice
 * review and the solo quiz results (pulled out of `ResultsSummary` on
 * 21 October 2026).
 */
const CHIP_TONE = {
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  negative: 'bg-destructive/10 text-destructive',
  quiet: 'bg-secondary text-muted-foreground',
} as const;

export type SummaryChipTone = keyof typeof CHIP_TONE;

export function SummaryChip({
  icon: Icon,
  tone,
  label,
}: {
  icon: LucideIcon;
  tone: SummaryChipTone;
  label: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        CHIP_TONE[tone],
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
