'use client';

import { Badge } from '@/components/ui/badge';
import {
  Megaphone,
  Send,
  BookOpenCheck,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationAnalyticsStatCards as StatCardsType } from '@/types/notification';

interface NotificationAnalyticsStatCardsProps {
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
      {Number(value).toFixed(1)}%
    </Badge>
  );
}

export function NotificationAnalyticsStatCards({
  statCards,
}: NotificationAnalyticsStatCardsProps) {
  const cards = [
    {
      key: 'total_broadcasts' as const,
      label: 'Total Broadcasts',
      icon: Megaphone,
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'total_notifications_sent' as const,
      label: 'Notifications Sent',
      icon: Send,
      format: (v: number) => v.toLocaleString(),
    },
    {
      key: 'read_rate' as const,
      label: 'Read Rate',
      icon: BookOpenCheck,
      format: (v: number) => `${Number(v).toFixed(1)}%`,
    },
    {
      key: 'avg_recipients_per_broadcast' as const,
      label: 'Avg Recipients',
      icon: Users,
      format: (v: number) => Number(v).toFixed(1),
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
              <p className="text-2xl font-bold tabular-nums">
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
