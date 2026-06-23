'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type {
  AdminUserPlanPeriodsData,
  PlanPeriodReconciliation,
  PlanPeriodTotals,
} from '@/types/admin-plan-periods';
import { AdminPlanPeriodsTable } from './AdminPlanPeriodsTable';
import { PlanPeriodBucketsGrid } from './PlanPeriodBucketsGrid';
import {
  PlanPeriodConversationsSheet,
  type PlanPeriodSlotSelection,
} from './PlanPeriodConversationsSheet';

interface AdminPlanPeriodsViewProps {
  userUuid: string;
  data: AdminUserPlanPeriodsData;
}

export function AdminPlanPeriodsView({ userUuid, data }: AdminPlanPeriodsViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<PlanPeriodSlotSelection | null>(null);

  return (
    <div className="space-y-6">
      <ReconciliationBanner reconciliation={data.reconciliation} />

      <TotalsRow totals={data.totals} />

      {/* Billing periods */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Billing periods</h2>
          <span className="text-xs text-muted-foreground">
            Click a row to see its conversations
          </span>
        </div>
        <AdminPlanPeriodsTable periods={data.plan_periods} onSelect={setSelectedSlot} />
      </section>

      {/* Buckets */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Other usage</h2>
          <span className="text-xs text-muted-foreground">
            Usage not tied to a paid period — grouped by funding source
          </span>
        </div>
        <PlanPeriodBucketsGrid buckets={data.buckets} onSelect={setSelectedSlot} />
      </section>

      <PlanPeriodConversationsSheet
        open={selectedSlot !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSlot(null);
        }}
        userUuid={userUuid}
        slot={selectedSlot}
      />
    </div>
  );
}

/******************************************************************************
                                 Functions
******************************************************************************/

/** Trust banner — proves every AI turn is accounted for, or flags the gap. */
function ReconciliationBanner({
  reconciliation,
}: {
  reconciliation: PlanPeriodReconciliation;
}) {
  const { exchangeRate, showNGN } = useCurrencyStore();
  const { balanced, sum_of_slots, user_total } = reconciliation;

  if (balanced) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3.5 dark:border-green-900/50 dark:bg-green-950/30">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
        <div className="text-sm text-green-900 dark:text-green-200">
          <span className="font-medium">Balanced.</span> Every AI turn is accounted
          for — periods plus buckets equal the user&apos;s grand total (
          {user_total.messages.toLocaleString()} messages ·{' '}
          {user_total.tokens.toLocaleString()} tokens ·{' '}
          {formatCost(user_total.cost, { showNGN, exchangeRate, decimals: 4 })}).
        </div>
      </div>
    );
  }

  const diff = {
    messages: user_total.messages - sum_of_slots.messages,
    tokens: user_total.tokens - sum_of_slots.tokens,
    cost: user_total.cost - sum_of_slots.cost,
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 dark:border-red-900/50 dark:bg-red-950/30">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="text-sm text-red-900 dark:text-red-200">
        <span className="font-medium">Unbalanced.</span> Slot totals don&apos;t match
        the user&apos;s grand total — {diff.messages.toLocaleString()} messages,{' '}
        {diff.tokens.toLocaleString()} tokens,{' '}
        {formatCost(diff.cost, { showNGN, exchangeRate, decimals: 4 })} unaccounted for.
      </div>
    </div>
  );
}

/** Grand totals across the user's entire history. */
function TotalsRow({ totals }: { totals: PlanPeriodTotals }) {
  const { exchangeRate, showNGN } = useCurrencyStore();

  const stats = [
    { label: 'Total messages', value: totals.messages.toLocaleString() },
    { label: 'Conversations', value: totals.conversations.toLocaleString() },
    { label: 'Total tokens', value: totals.tokens.toLocaleString() },
    {
      label: 'Total cost',
      value: formatCost(totals.cost, { showNGN, exchangeRate, decimals: 4 }),
      mono: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tabular-nums',
              stat.mono && 'font-mono'
            )}
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
