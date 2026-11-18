'use client';

import Link from 'next/link';
import { AlertTriangle, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatShare, formatUsd, periodLabel, shareTone } from '@/lib/utils/cost-alerts';
import type { CostAlert } from '@/types/admin-cost-alerts';

/**
 * The cost alerts table: who, on which plan, what they cost against what they
 * pay, and how many replies. Each user links to their admin page. The share is
 * red at twice the threshold or more, amber below that.
 */
export function CostAlertsTable({
  rows,
  threshold,
  isLoading,
  error,
  filteredToUser,
}: {
  rows: CostAlert[] | undefined;
  threshold: number;
  isLoading: boolean;
  error: Error | null;
  filteredToUser: boolean;
}) {
  if (isLoading && !rows) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p role="alert" className="flex items-center gap-2 py-8 text-sm text-destructive">
        <TriangleAlert aria-hidden className="h-4 w-4" />
        The cost alerts did not load. {error.message}
      </p>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {filteredToUser
          ? 'This user has no cost alerts in these periods.'
          : 'No user has reached the threshold in these periods.'}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Plan price</TableHead>
            <TableHead className="text-right">Share</TableHead>
            <TableHead className="text-right">Replies</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((alert) => {
            const severe = shareTone(alert.percent, threshold) === 'severe';
            return (
              <TableRow key={alert.uuid}>
                <TableCell className="max-w-[240px]">
                  {alert.user ? (
                    <>
                      <Link href={`/admin/users/${alert.user.uuid}`} className="block truncate font-medium text-sm hover:underline">
                        {alert.user.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{alert.user.email || 'No email'}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Deleted user</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {alert.plan ? (
                    <>
                      {alert.plan.name}
                      <span className="block text-xs text-muted-foreground">
                        {alert.plan.currency} {Number(alert.plan.amount).toLocaleString('en-US')} · {alert.plan.interval}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Plan removed</span>
                  )}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {periodLabel(alert.period.start, alert.period.end)}
                  {alert.period.is_current ? (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Current
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatUsd(alert.cost_usd)}
                  <span className="block text-xs text-muted-foreground">
                    AI {formatUsd(alert.ai_cost_usd)} · web {formatUsd(alert.web_cost_usd)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatUsd(alert.price_usd)}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
                      severe ? 'text-destructive' : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
                    {formatShare(alert.percent)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{alert.turns.toLocaleString('en-US')}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
