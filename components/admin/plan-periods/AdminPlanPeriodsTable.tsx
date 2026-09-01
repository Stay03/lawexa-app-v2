'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCost, getCurrencySymbol } from '@/lib/utils/currency';
import { formatMoneyMajor } from '@/lib/utils/payment-format';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type { PlanPeriod, PlanPeriodProvider, PlanPeriodSource } from '@/types/admin-plan-periods';
import type { PlanPeriodSlotSelection } from './PlanPeriodConversationsSheet';

interface AdminPlanPeriodsTableProps {
  periods: PlanPeriod[];
  onSelect: (slot: PlanPeriodSlotSelection) => void;
}

const PROVIDER_STYLES: Record<PlanPeriodProvider, string> = {
  paystack:
    'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
  flutterwave:
    'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  granted:
    'text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-amber-950/50',
};

const STATUS_STYLES: Record<string, string> = {
  success:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  pending:
    'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  failed:
    'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
};

const SOURCE_LABEL: Record<PlanPeriodSource, string> = {
  invoice: 'invoice',
  granted: 'granted',
  synthesized: 'synthesized',
};

function formatDay(value: string | null): string {
  return value ? format(new Date(value), 'd MMM yyyy') : '—';
}

export function AdminPlanPeriodsTable({ periods, onSelect }: AdminPlanPeriodsTableProps) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();

  if (periods.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No billing periods for this user.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">Plan</TableHead>
            <TableHead className="font-semibold">Window</TableHead>
            <TableHead className="font-semibold">Amount</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="text-right font-semibold">Messages</TableHead>
            <TableHead className="text-right font-semibold">Tokens</TableHead>
            <TableHead className="text-right font-semibold">
              Cost ({getCurrencySymbol(showNGN)})
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {periods.map((period, index) => {
            const funding = Object.entries(period.usage.funding_breakdown);
            return (
              <TableRow
                key={period.key}
                className={cn(
                  'cursor-pointer align-top transition-colors hover:bg-muted/40',
                  index % 2 === 1 && 'bg-muted/30'
                )}
                onClick={() =>
                  onSelect({
                    key: period.key,
                    title: `${period.plan.name} · ${period.key}`,
                    subtitle: `${formatDay(period.period_start)} → ${
                      period.period_end ? formatDay(period.period_end) : 'Ongoing'
                    }`,
                  })
                }
              >
                {/* Plan */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{period.plan.name}</span>
                    {period.is_current && (
                      <Badge className="text-[10px]">Current</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] capitalize', PROVIDER_STYLES[period.provider])}
                    >
                      {period.provider}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {SOURCE_LABEL[period.source]}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {period.key}
                    </span>
                  </div>
                </TableCell>

                {/* Window */}
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  <div>{formatDay(period.period_start)}</div>
                  <div>
                    →{' '}
                    {period.period_end ? (
                      formatDay(period.period_end)
                    ) : (
                      <span className="italic">Ongoing</span>
                    )}
                  </div>
                  {period.derived_dates && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      derived dates
                    </Badge>
                  )}
                </TableCell>

                {/* Amount */}
                <TableCell className="whitespace-nowrap text-sm tabular-nums">
                  {formatMoneyMajor(Number(period.amount), period.currency)}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] capitalize', STATUS_STYLES[period.status])}
                  >
                    {period.status}
                  </Badge>
                  {period.paid && (
                    <Badge
                      variant="outline"
                      className="ml-1 text-[10px] text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50"
                    >
                      paid
                    </Badge>
                  )}
                </TableCell>

                {/* Messages + funding breakdown */}
                <TableCell className="text-right">
                  <span className="tabular-nums">{period.usage.messages}</span>
                  {funding.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                      {funding.map(([tier, count]) => (
                        <Badge
                          key={tier}
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          {tier} ×{count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>

                {/* Tokens */}
                <TableCell className="text-right tabular-nums">
                  {period.usage.tokens.toLocaleString()}
                </TableCell>

                {/* Cost */}
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {formatCost(period.usage.cost, { showNGN, exchangeRate, decimals: 4 })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
