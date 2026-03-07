'use client';

import {
  Users,
  UserCheck,
  UserPlus,
  UserMinus,
  TrendingUp,
  Receipt,
  Percent,
  BarChart3,
} from 'lucide-react';
import { ChangePercentBadge } from '@/components/admin/analytics/ChangePercentBadge';
import { formatNaira } from '@/lib/utils/currency';
import type { SubscriptionAnalyticsStatCards as StatCardsType } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const COUNT_CARDS = [
  { key: 'total_subscriptions' as const, label: 'Total Subscriptions', icon: Users, format: 'number' },
  { key: 'active_subscriptions' as const, label: 'Active Subscriptions', icon: UserCheck, format: 'number' },
  { key: 'new_subscriptions' as const, label: 'New Subscriptions', icon: UserPlus, format: 'number' },
  { key: 'churned_subscriptions' as const, label: 'Churned', icon: UserMinus, format: 'number' },
];

const FINANCIAL_CARDS = [
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

/******************************************************************************
                                 Functions
******************************************************************************/

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

/******************************************************************************
                                 Types
******************************************************************************/

interface SubscriptionStatCardsProps {
  statCards: StatCardsType;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Renders 8 subscription analytics stat cards in two
 * semantic rows: counts (top) and financials (bottom).
 */
function SubscriptionStatCards({ statCards }: SubscriptionStatCardsProps) {
  return (
    <div className="space-y-4">
      {/* Counts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COUNT_CARDS.map((card, index) => {
          const stat = statCards[card.key];
          const color = CARD_COLORS[index];
          const value = (stat.value as number | null) ?? null;
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold tabular-nums">
                  {formatValue(value, card.format)}
                </p>
                <ChangePercentBadge value={stat.change_percent} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Financials row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FINANCIAL_CARDS.map((card, index) => {
          const stat = statCards[card.key];
          const color = CARD_COLORS[index + 4];
          const value = (stat.value as number | null) ?? null;
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold tabular-nums">
                  {formatValue(value, card.format)}
                </p>
                <ChangePercentBadge value={stat.change_percent} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { SubscriptionStatCards };
