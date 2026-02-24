'use client';

import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { LawyerVerificationStats } from '@/types/admin-lawyer-verification';

interface LawyerVerificationStatsRowProps {
  stats: LawyerVerificationStats | undefined;
  isLoading: boolean;
}

/**
 * Stats overview row with 4 cards: Total, Pending, Approved, Rejected.
 * Follows the QuickStatsRow pattern.
 */
export function LawyerVerificationStatsRow({
  stats,
  isLoading,
}: LawyerVerificationStatsRowProps) {
  const statCards = [
    {
      label: 'Total Profiles',
      value: stats?.total ?? 0,
      icon: Users,
      iconClass: '',
    },
    {
      label: 'Pending Review',
      value: stats?.pending ?? 0,
      icon: Clock,
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Approved',
      value: stats?.approved ?? 0,
      icon: CheckCircle2,
      iconClass: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Rejected',
      value: stats?.rejected ?? 0,
      icon: XCircle,
      iconClass: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <stat.icon className={cn('h-4 w-4', stat.iconClass)} />
            <span className="text-xs font-medium">{stat.label}</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">
              {stat.value.toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
