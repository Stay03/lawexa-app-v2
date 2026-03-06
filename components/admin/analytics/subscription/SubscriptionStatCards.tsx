'use client';

import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserCheck,
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  Receipt,
  Percent,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/utils/currency';
import type { SubscriptionAnalyticsStatCards as StatCardsType } from '@/types/admin';

interface SubscriptionStatCardsProps {
  statCards: StatCardsType;
}

/**
 * Change percentage badge component.
 */
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
      {Number(value).toFixed(1)}%
    </Badge>
  );
}

const cards = [
  { key: 'total_subscriptions' as const, label: 'Total Subscriptions', icon: Users, format: 'number' },
  { key: 'active_subscriptions' as const, label: 'Active Subscriptions', icon: UserCheck, format: 'number' },
  { key: 'new_subscriptions' as const, label: 'New Subscriptions', icon: UserPlus, format: 'number' },
  { key: 'churned_subscriptions' as const, label: 'Churned', icon: UserMinus, format: 'number' },
  { key: 'mrr' as const, label: 'MRR', icon: TrendingUp, format: 'naira_decimal' },
  { key: 'revenue' as const, label: 'Revenue', icon: Receipt, format: 'naira' },
  { key: 'churn_rate' as const, label: 'Churn Rate', icon: Percent, format: 'percent' },
  { key: 'avg_revenue_per_user' as const, label: 'ARPU', icon: BarChart3, format: 'naira' },
];

const CARD_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
];

/**
 * Format stat card value based on its format type.
 */
function formatValue(value: number | null, format: string): string {
  if (value === null || value === undefined) return 'N/A';
  switch (format) {
    case 'naira':
      return formatNaira(value);
    case 'naira_decimal':
      return formatNaira(value, { decimals: 2 });
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString();
  }
}

/**
 * Default component. Renders 8 subscription analytics stat cards.
 */
function SubscriptionStatCards({ statCards }: SubscriptionStatCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const stat = statCards[card.key];
        const color = CARD_COLORS[index];
        // churn_rate.value can be null from the API
        const value = (stat.value as number | null) ?? null;
        return (
          <div
            key={card.key}
            className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {formatValue(value, card.format)}
            </p>
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

export { SubscriptionStatCards };
