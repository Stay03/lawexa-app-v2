'use client';

import {
  Receipt,
  Package,
  MessageSquare,
  MessageSquareDashed,
  Percent,
  BarChart3,
} from 'lucide-react';
import { ChangePercentBadge } from '@/components/admin/analytics/ChangePercentBadge';
import { formatNaira } from '@/lib/utils/currency';
import type { MessagePackAnalyticsStatCards as StatCardsType } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const REVENUE_CARDS = [
  { key: 'total_revenue' as const, label: 'Total Revenue', icon: Receipt, format: 'naira' },
  { key: 'total_packs_sold' as const, label: 'Packs Sold', icon: Package, format: 'number' },
  { key: 'total_messages_purchased' as const, label: 'Messages Purchased', icon: MessageSquare, format: 'number' },
];

const USAGE_CARDS = [
  { key: 'total_messages_consumed' as const, label: 'Messages Consumed', icon: MessageSquareDashed, format: 'number' },
  { key: 'consumption_rate' as const, label: 'Consumption Rate', icon: Percent, format: 'percent' },
  { key: 'avg_pack_size' as const, label: 'Avg Pack Size', icon: BarChart3, format: 'float' },
];

const CARD_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
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
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'float':
      return value.toFixed(1);
    default:
      return value.toLocaleString();
  }
}

/******************************************************************************
                                 Types
******************************************************************************/

interface MessagePackStatCardsProps {
  statCards: StatCardsType;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Renders 6 message pack analytics stat cards in two
 * semantic rows: revenue (top) and usage (bottom).
 */
function MessagePackStatCards({ statCards }: MessagePackStatCardsProps) {
  return (
    <div className="space-y-4">
      {/* Revenue row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REVENUE_CARDS.map((card, index) => {
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

      {/* Usage row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {USAGE_CARDS.map((card, index) => {
          const stat = statCards[card.key];
          const color = CARD_COLORS[index + 3];
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

export { MessagePackStatCards };
