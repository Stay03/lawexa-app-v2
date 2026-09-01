'use client';

import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Users,
  Clock,
  AlertTriangle,
  Coins,
  MessageCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type { AnalyticsStatCards as StatCardsType } from '@/types/admin';

interface AnalyticsStatCardsProps {
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

/**
 * Default component. Renders 6 analytics stat cards in a responsive grid.
 */
function AnalyticsStatCards({ statCards }: AnalyticsStatCardsProps) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();

  const cards = [
    {
      key: 'total_conversations' as const,
      label: 'Total Conversations',
      icon: MessageSquare,
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'active_users' as const,
      label: 'Active Users',
      icon: Users,
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'avg_response_time' as const,
      label: 'Avg Response Time',
      icon: Clock,
      format: (v: number) => `${Number(v).toFixed(1)}s`,
    },
    {
      key: 'error_rate' as const,
      label: 'Error Rate',
      icon: AlertTriangle,
      format: (v: number) => `${Number(v).toFixed(1)}%`,
    },
    {
      key: 'total_cost' as const,
      label: 'Total Cost',
      icon: Coins,
      format: (v: number) =>
        formatCost(v, { showNGN, exchangeRate, decimals: 4 }),
      mono: true,
    },
    {
      key: 'avg_messages_per_conversation' as const,
      label: 'Avg Messages / Conv',
      icon: MessageCircle,
      format: (v: number) => Number(v).toFixed(1),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

export { AnalyticsStatCards };
