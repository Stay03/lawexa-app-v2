'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type StatTone = 'default' | 'warning' | 'danger';

const CHIP_CLASSES: Record<StatTone, string> = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-destructive/10 text-destructive',
};

interface SummaryStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: StatTone;
}

export function SummaryStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: SummaryStatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            CHIP_CLASSES[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Fixed-height skeleton matching SummaryStatCard, for loading grids. */
export function SummaryStatCardSkeleton() {
  return <Skeleton className="h-[92px] w-full" />;
}
