'use client';

import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Users,
  UserCheck,
  Bot,
  Search,
  Share2,
  SearchCode,
  Globe,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewAnalyticsStatCards as StatCardsType } from '@/types/admin';

interface ViewAnalyticsStatCardsProps {
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
  { key: 'total_views' as const, label: 'Total Views', icon: Eye },
  { key: 'unique_visitors' as const, label: 'Unique Visitors', icon: Users },
  { key: 'human_views' as const, label: 'Human Views', icon: UserCheck },
  { key: 'bot_views' as const, label: 'Bot Views', icon: Bot },
  { key: 'search_engine_crawls' as const, label: 'Search Engine Crawls', icon: Search },
  { key: 'social_media_crawls' as const, label: 'Social Media Crawls', icon: Share2 },
  { key: 'internal_search_views' as const, label: 'Internal Search Views', icon: SearchCode },
  { key: 'countries_reached' as const, label: 'Countries Reached', icon: Globe },
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
 * Default component. Renders 8 view analytics stat cards in a responsive grid.
 */
function ViewAnalyticsStatCards({ statCards }: ViewAnalyticsStatCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const stat = statCards[card.key];
        const color = CARD_COLORS[index];
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
              {stat.value.toLocaleString()}
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

export { ViewAnalyticsStatCards };
