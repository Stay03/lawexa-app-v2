'use client';

import { useState } from 'react';
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
  const [showTokens, setShowTokens] = useState(false);

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
  ];

  // 4th card: toggleable between Cost and Tokens
  const costTokenStat = showTokens ? statCards.total_tokens : statCards.total_cost;
  const costTokenLabel = showTokens ? 'Total Tokens' : 'Total Cost';
  const costTokenColor = 'var(--chart-4)';
  const costTokenValue = showTokens
    ? costTokenStat.value.toLocaleString()
    : formatCost(costTokenStat.value, { showNGN, exchangeRate, decimals: 4 });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* First 3 cards */}
      {cards.map((card) => {
        const stat = statCards[card.key];
        return (
          <div
            key={card.key}
            className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: card.color }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {card.format(stat.value)}
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

      {/* 4th card: Cost / Tokens toggle */}
      <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: costTokenColor }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {costTokenLabel}
            </span>
          </div>
          <div className="flex rounded-md border">
            <button
              onClick={() => setShowTokens(false)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-medium transition-colors rounded-l-md',
                !showTokens
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Cost
            </button>
            <button
              onClick={() => setShowTokens(true)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-medium transition-colors rounded-r-md border-l',
                showTokens
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Tokens
            </button>
          </div>
        </div>
        <p
          className={cn(
            'mt-2 text-2xl font-bold tabular-nums',
            !showTokens && 'font-mono'
          )}
        >
          {costTokenValue}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <ChangePercentBadge value={costTokenStat.change_percent} />
          <span className="text-xs text-muted-foreground">
            vs prior period
          </span>
        </div>
      </div>
    </div>
  );
}

export { UserAnalyticsStatCards };
