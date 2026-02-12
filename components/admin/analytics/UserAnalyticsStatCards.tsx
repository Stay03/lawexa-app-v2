'use client';

import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { UserAnalyticsStatCards as StatCardsType } from '@/types/admin';

interface UserAnalyticsStatCardsProps {
  statCards: StatCardsType;
}

function ChangePercentBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Badge variant="outline" className="text-xs">
        N/A
      </Badge>
    );
  }
  if (value === 0) {
    return (
      <Badge variant="outline" className="text-xs">
        0%
      </Badge>
    );
  }
  const isPositive = value > 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs gap-0.5',
        isPositive
          ? 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50'
          : 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50'
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPositive ? '+' : ''}
      {value.toFixed(1)}%
    </Badge>
  );
}

function UserAnalyticsStatCards({ statCards }: UserAnalyticsStatCardsProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();

  const cards = [
    {
      key: 'new_users' as const,
      label: 'New Users',
      color: 'var(--chart-1)',
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'total_conversations' as const,
      label: 'Conversations',
      color: 'var(--chart-2)',
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'total_ai_responses' as const,
      label: 'AI Responses',
      color: 'var(--chart-3)',
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'total_cost' as const,
      label: 'Total Cost',
      color: 'var(--chart-4)',
      format: (v: number) =>
        formatCost(v, { showNGN, exchangeRate, decimals: 4 }),
      mono: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const stat = statCards[card.key];
        return (
          <div
            key={card.key}
            className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5 border-l-[3px]"
            style={{ borderLeftColor: card.color }}
          >
            {/* Label with colored dot */}
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: card.color }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
            </div>

            {/* Value */}
            <p
              className={cn(
                'mt-2 text-2xl font-bold tabular-nums',
                card.mono && 'font-mono'
              )}
            >
              {card.format(stat.value)}
            </p>

            {/* Change percentage with context */}
            <div className="mt-3 flex items-center gap-1.5">
              <ChangePercentBadge value={stat.change_percent} />
              <span className="text-xs text-muted-foreground">
                vs prior period
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { UserAnalyticsStatCards };
