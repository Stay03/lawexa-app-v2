'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Table2 } from 'lucide-react';
import { formatNaira } from '@/lib/utils/currency';
import type { PlanBreakdownRow } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

interface PlanBreakdownTableProps {
  data: PlanBreakdownRow[];
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Plan breakdown table showing per-plan metrics.
 */
function PlanBreakdownTable({ data }: PlanBreakdownTableProps) {
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        active: acc.active + row.active_count,
        new: acc.new + row.new_in_period,
        churned: acc.churned + row.churned_in_period,
        revenue: acc.revenue + row.revenue_in_period,
        mrr: acc.mrr + row.mrr_contribution,
      }),
      { active: 0, new: 0, churned: 0, revenue: 0, mrr: 0 }
    );
  }, [data]);

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Breakdown</CardTitle>
          <CardDescription>Per-plan subscription metrics</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Table2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No plan data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Breakdown</CardTitle>
        <CardDescription>Per-plan subscription metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Churned</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">MRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.plan_name}>
                <TableCell className="font-medium">{row.plan_name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.active_count}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.new_in_period}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.churned_in_period}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatNaira(row.revenue_in_period)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatNaira(row.mrr_contribution, { decimals: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {totals.active}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {totals.new}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {totals.churned}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                {formatNaira(totals.revenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                {formatNaira(totals.mrr, { decimals: 2 })}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

export { PlanBreakdownTable };
