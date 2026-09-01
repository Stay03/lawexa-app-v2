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
import type { SubscriptionAnalyticsStatCards as StatCardsType } from '@/types/admin';
import {
  analyticsMoneyLines,
  analyticsChange,
  currenciesOf,
  amountFor,
  type AnalyticsMoney,
} from '../money';

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
/**
 * Every line a card should print, in order.
 *
 * MONEY RETURNS ONE LINE PER CURRENCY, because naira and dollars cannot be
 * added and must not share a figure. Counts and percentages return one line,
 * having no currency to divide by.
 *
 * AN EMPTY LIST MEANS THERE IS NOTHING TO SHOW, AND IS NOT ZERO. The server
 * sends an empty map for a period in which no money arrived, deliberately,
 * because a 0.00 would name a currency it did not. The caller draws a dash.
 */
function formatValueLines(value: AnalyticsMoney, format: string): string[] {
  if (value === null || value === undefined) return [];
  if (format === 'naira' || format === 'naira_decimal') {
    return analyticsMoneyLines(value);
  }
  /* Not money — a count or a percentage — so it is a plain number in both the
     old shape and the new one. */
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return [];
  return [format === 'percent' ? `${n.toFixed(1)}%` : n.toLocaleString()];
}

/**
 * A card's figures — one line per currency, each with ITS OWN change badge.
 *
 * The pairing is the point. A single change percentage over two currencies is
 * the same error as a single total, only harder to notice because a percentage
 * looks unitless. Naira up 12% while dollars are new is two facts, and one
 * badge can only tell a lie about them.
 *
 * Falls back to the old single figure and single badge when the server is still
 * sending a number, so this renders correctly on both sides of that deploy.
 */
function CardFigures({
  value,
  format,
  change,
}: {
  value: AnalyticsMoney;
  format: string;
  change: number | Record<string, number | null> | null;
}) {
  const currencies = currenciesOf(value);

  /* Legacy shape, or a non-money card: one figure, one badge, as today. */
  if (currencies.length === 0) {
    const lines = formatValueLines(value, format);
    return (
      <>
        <p className="text-2xl font-bold tabular-nums">
          {lines[0] ?? <span className="text-muted-foreground">—</span>}
        </p>
        <ChangePercentBadge value={analyticsChange(change)} />
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {currencies.map((code) => (
        <div key={code} className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tabular-nums leading-tight">
            {amountFor(value, code)}
          </span>
          <ChangePercentBadge value={analyticsChange(change, code)} />
        </div>
      ))}
    </div>
  );
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
                <CardFigures
                  value={value}
                  format={card.format}
                  change={stat.change_percent}
                />
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
                <CardFigures
                  value={value}
                  format={card.format}
                  change={stat.change_percent}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { SubscriptionStatCards };
