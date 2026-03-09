'use client';

import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Users, Activity } from 'lucide-react';
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

function SubCount({ registered, guest }: { registered: number; guest: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{registered.toLocaleString()} registered</span>
      <span className="text-foreground/20">·</span>
      <span>{guest.toLocaleString()} guest</span>
    </div>
  );
}

function UserAnalyticsStatCards({ statCards }: UserAnalyticsStatCardsProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();

  return (
    <div className="space-y-4">
      {/* Row 1: Online, New Users, Total Users, Activation Rate, Returning Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Currently Online */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Currently Online
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {statCards.currently_online.value.toLocaleString()}
          </p>
          <div className="mt-2">
            <SubCount
              registered={statCards.currently_online.registered}
              guest={statCards.currently_online.guest}
            />
          </div>
        </div>

        {/* New Users */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--chart-1)' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              New Users
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {statCards.new_users.value.toLocaleString()}
          </p>
          <div className="mt-1">
            <SubCount
              registered={statCards.new_users.registered}
              guest={statCards.new_users.guest}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.new_users.change_percent} />
            <span className="text-xs text-muted-foreground">vs prior period</span>
          </div>
        </div>

        {/* Total Users */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Users
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {statCards.total_users.value.toLocaleString()}
          </p>
          <div className="mt-1">
            <SubCount
              registered={statCards.total_users.registered}
              guest={statCards.total_users.guest}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.total_users.change_percent} />
            <span className="text-xs text-muted-foreground">vs prior period</span>
          </div>
        </div>

        {/* Activation Rate */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Activation Rate
            </span>
          </div>
          <div className="mt-2 space-y-2">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">AI</span>
                <span className="text-lg font-bold tabular-nums">
                  {statCards.activation_rate.ai_activation.value.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ChangePercentBadge value={statCards.activation_rate.ai_activation.change_percent} />
                <span className="text-[10px] text-muted-foreground">
                  {statCards.activation_rate.ai_activation.activated_count}/{statCards.activation_rate.ai_activation.total_signups}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Content</span>
                <span className="text-lg font-bold tabular-nums">
                  {statCards.activation_rate.content_activation.value.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ChangePercentBadge value={statCards.activation_rate.content_activation.change_percent} />
                <span className="text-[10px] text-muted-foreground">
                  {statCards.activation_rate.content_activation.activated_count}/{statCards.activation_rate.content_activation.total_signups}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Returning Users */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--chart-5)' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Returning Users
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {statCards.returning_users.value.toLocaleString()}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{statCards.returning_users.returning_rate.toFixed(1)}% return rate</span>
          </div>
          <div className="mt-1">
            <SubCount
              registered={statCards.returning_users.registered}
              guest={statCards.returning_users.guest}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.returning_users.change_percent} />
            <span className="text-xs text-muted-foreground">vs prior period</span>
          </div>
        </div>
      </div>

      {/* Row 2: Conversations, AI Responses, Cost/Tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Conversations */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--chart-2)' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Conversations
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {statCards.total_conversations.value.toLocaleString()}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.total_conversations.change_percent} />
            <span className="text-xs text-muted-foreground">vs prior period</span>
          </div>
        </div>

        {/* AI Responses */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--chart-3)' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI Responses
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {statCards.total_ai_responses.value.toLocaleString()}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.total_ai_responses.change_percent} />
            <span className="text-xs text-muted-foreground">vs prior period</span>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--chart-4)' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Tokens
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {statCards.total_tokens.value.toLocaleString()}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.total_tokens.change_percent} />
            <span className="text-xs text-muted-foreground">vs prior period</span>
          </div>
        </div>

        {/* Total Cost */}
        <div className="rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--chart-4)' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Cost
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums font-mono">
            {formatCost(statCards.total_cost.value, { showNGN, exchangeRate, decimals: 4 })}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.total_cost.change_percent} />
            <span className="text-xs text-muted-foreground">vs prior period</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { UserAnalyticsStatCards };
