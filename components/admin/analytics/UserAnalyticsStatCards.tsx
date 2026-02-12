'use client';

import { Badge } from '@/components/ui/badge';
import {
  UserPlus,
  MessageSquare,
  Bot,
  Coins,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { UserAnalyticsStatCards as StatCardsType } from '@/types/admin';

interface UserAnalyticsStatCardsProps {
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
      {value.toFixed(1)}%
    </Badge>
  );
}

/**
 * Default component. Renders 4 user analytics stat cards in a responsive grid.
 */
function UserAnalyticsStatCards({ statCards }: UserAnalyticsStatCardsProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();

  const cards = [
    {
      key: 'new_users' as const,
      label: 'New Users',
      icon: UserPlus,
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'total_conversations' as const,
      label: 'Total Conversations',
      icon: MessageSquare,
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'total_ai_responses' as const,
      label: 'AI Responses',
      icon: Bot,
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'total_cost' as const,
      label: 'Total Cost',
      icon: Coins,
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
          <div key={card.key} className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <card.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{card.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  card.mono && 'font-mono'
                )}
              >
                {card.format(stat.value)}
              </p>
              <ChangePercentBadge value={stat.change_percent} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { UserAnalyticsStatCards };
