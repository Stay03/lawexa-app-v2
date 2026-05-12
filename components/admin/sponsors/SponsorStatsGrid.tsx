'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SponsorStat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string | null;
}

interface SponsorStatsGridProps {
  stats: SponsorStat[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

const COLUMN_CLASSES: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
};

export function SponsorStatsGrid({
  stats,
  columns = 4,
  className,
}: SponsorStatsGridProps) {
  return (
    <div className={cn('grid gap-4', COLUMN_CLASSES[columns], className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <stat.icon className="h-4 w-4" />
            <span className="text-xs font-medium">{stat.label}</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
          {stat.subtext && (
            <p className="text-xs text-muted-foreground mt-1">
              {stat.subtext}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
