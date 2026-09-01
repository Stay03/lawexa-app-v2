'use client';

import { UserPlus, MessageSquare, Activity, RotateCcw, Zap } from 'lucide-react';
import { formatCost, formatCompact } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { ChangePercentBadge } from '@/components/admin/analytics/ChangePercentBadge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import type { UserAnalyticsStatCards as StatCardsType } from '@/types/admin';

interface UserAnalyticsStatCardsProps {
  statCards: StatCardsType;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function SubCount({
  registered,
  guest,
}: {
  registered: number;
  guest: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{registered.toLocaleString()} registered</span>
      <span className="text-foreground/20">·</span>
      <span>{guest.toLocaleString()} guest</span>
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.min(value, 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

const CARD =
  'rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 p-5';

/* ------------------------------------------------------------------ */
/*  Card 1 — New Users (acquisition this period)                       */
/* ------------------------------------------------------------------ */

function NewUsersCard({ statCards }: { statCards: StatCardsType }) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          New Users
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <p className="text-3xl font-bold tabular-nums">
          {statCards.new_users.value.toLocaleString()}
        </p>
        <ChangePercentBadge value={statCards.new_users.change_percent} />
      </div>

      <div className="mt-1.5">
        <SubCount
          registered={statCards.new_users.registered}
          guest={statCards.new_users.guest}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 2 — Engagement (merged Conversations + AI Responses)          */
/* ------------------------------------------------------------------ */

function EngagementCard({ statCards }: { statCards: StatCardsType }) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Engagement
        </span>
      </div>

      <p className="mt-2 text-3xl font-bold tabular-nums">
        {statCards.total_conversations.value.toLocaleString()}
      </p>

      <div className="mt-1">
        <span className="text-sm text-muted-foreground">
          {statCards.total_ai_responses.value.toLocaleString()} AI responses
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <ChangePercentBadge
          value={statCards.total_conversations.change_percent}
        />
        <ChangePercentBadge
          value={statCards.total_ai_responses.change_percent}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 3 — Activation Rate (redesigned with progress bars)           */
/* ------------------------------------------------------------------ */

function ActivationRateCard({ statCards }: { statCards: StatCardsType }) {
  const { ai_activation, content_activation } = statCards.activation_rate;

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activation Rate
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {/* AI Activation */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              AI
            </span>
            <span className="text-sm font-bold tabular-nums">
              {ai_activation.value.toFixed(1)}%
            </span>
          </div>
          <ProgressBar value={ai_activation.value} color="var(--chart-1)" />
          <div className="flex items-center gap-1.5">
            <ChangePercentBadge value={ai_activation.change_percent} />
            <span className="text-[10px] text-muted-foreground">
              {ai_activation.activated_count}/{ai_activation.total_signups}
            </span>
          </div>
        </div>

        {/* Content Activation */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Content
            </span>
            <span className="text-sm font-bold tabular-nums">
              {content_activation.value.toFixed(1)}%
            </span>
          </div>
          <ProgressBar
            value={content_activation.value}
            color="var(--chart-3)"
          />
          <div className="flex items-center gap-1.5">
            <ChangePercentBadge value={content_activation.change_percent} />
            <span className="text-[10px] text-muted-foreground">
              {content_activation.activated_count}/
              {content_activation.total_signups}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 4 — Returning Users (return rate as hero)                     */
/* ------------------------------------------------------------------ */

function ReturningUsersCard({ statCards }: { statCards: StatCardsType }) {
  const { returning_users } = statCards;

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Returning Users
        </span>
      </div>

      <p className="mt-2 text-3xl font-bold tabular-nums">
        {returning_users.returning_rate.toFixed(1)}%
      </p>

      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">
          {returning_users.value.toLocaleString()} users returned
        </span>
        <ChangePercentBadge value={returning_users.change_percent} />
      </div>

      <div className="mt-1.5">
        <SubCount
          registered={returning_users.registered}
          guest={returning_users.guest}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 5 — AI Usage (Tokens ↔ Cost toggle)                          */
/* ------------------------------------------------------------------ */

function AIUsageCard({ statCards }: { statCards: StatCardsType }) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();

  return (
    <div className={CARD}>
      <Tabs defaultValue="tokens" className="gap-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI Usage
            </span>
          </div>
          <TabsList className="h-7">
            <TabsTrigger
              value="tokens"
              className="text-[11px] px-2 py-0.5 h-6"
            >
              Tokens
            </TabsTrigger>
            <TabsTrigger
              value="cost"
              className="text-[11px] px-2 py-0.5 h-6"
            >
              Cost
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tokens" className="mt-2">
          <p className="text-3xl font-bold tabular-nums">
            {formatCompact(statCards.total_tokens.value)}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.total_tokens.change_percent} />
            <span className="text-xs text-muted-foreground">
              vs prior period
            </span>
          </div>
        </TabsContent>

        <TabsContent value="cost" className="mt-2">
          <p className="text-3xl font-bold tabular-nums font-mono">
            {formatCost(statCards.total_cost.value, {
              showNGN,
              exchangeRate,
              decimals: 2,
            })}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <ChangePercentBadge value={statCards.total_cost.change_percent} />
            <span className="text-xs text-muted-foreground">
              vs prior period
            </span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Export                                                        */
/* ------------------------------------------------------------------ */

function UserAnalyticsStatCards({ statCards }: UserAnalyticsStatCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      <NewUsersCard statCards={statCards} />
      <EngagementCard statCards={statCards} />
      <ActivationRateCard statCards={statCards} />
      <ReturningUsersCard statCards={statCards} />
      <AIUsageCard statCards={statCards} />
    </div>
  );
}

export { UserAnalyticsStatCards };
