'use client';

import type { LucideIcon } from 'lucide-react';
import { ChangePercentBadge } from '@/components/admin/analytics/ChangePercentBadge';

interface AdminQuizStatCardProps {
  label: string;
  /** Pre-formatted display value (the caller formats counts / percent / duration). */
  value: string;
  icon: LucideIcon;
  /** Prior-period delta; `null` renders as "—" (no baseline). */
  changePercent: number | null;
}

/** A usage stat tile: icon + label, a big value, and a prior-period delta badge. */
export function AdminQuizStatCard({
  label,
  value,
  icon: Icon,
  changePercent,
}: AdminQuizStatCardProps) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <ChangePercentBadge value={changePercent} nullLabel="—" />
      </div>
    </div>
  );
}
