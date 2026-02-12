'use client';

import { formatCost } from '@/lib/utils/currency';
import { MessageSquare, Hash, Coins, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminUserUsageSummary } from '@/types/admin';

interface QuickStatsRowProps {
  conversationsCount: number;
  usageSummary: AdminUserUsageSummary;
  showNGN: boolean;
  exchangeRate: number;
}

export function QuickStatsRow({
  conversationsCount,
  usageSummary,
  showNGN,
  exchangeRate,
}: QuickStatsRowProps) {
  const stats = [
    {
      label: 'Conversations',
      value: conversationsCount.toLocaleString(),
      icon: MessageSquare,
      subtext: null,
    },
    {
      label: 'Total Tokens',
      value: usageSummary.total_tokens.toLocaleString(),
      icon: Hash,
      subtext: `${usageSummary.prompt_tokens.toLocaleString()} in / ${usageSummary.completion_tokens.toLocaleString()} out`,
    },
    {
      label: 'Total Cost',
      value: formatCost(usageSummary.total_cost, {
        showNGN,
        exchangeRate,
        decimals: 2,
      }),
      icon: Coins,
      subtext: null,
      mono: true,
    },
    {
      label: 'AI Requests',
      value: usageSummary.total_requests.toLocaleString(),
      icon: Zap,
      subtext: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <stat.icon className="h-4 w-4" />
            <span className="text-xs font-medium">{stat.label}</span>
          </div>
          <p
            className={cn('text-2xl font-bold tabular-nums', stat.mono && 'font-mono')}
          >
            {stat.value}
          </p>
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
