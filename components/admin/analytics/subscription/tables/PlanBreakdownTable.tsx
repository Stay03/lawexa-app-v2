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
import { analyticsMoneyLines, type AnalyticsMoney } from '../../money';
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
/** One money cell: a line per currency, a dash when the server reported none. */
function MoneyCell({ value }: { value: AnalyticsMoney }) {
  const lines = analyticsMoneyLines(value);
  if (lines.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col items-end leading-tight">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  );
}

function PlanBreakdownTable({ data }: PlanBreakdownTableProps) {
  /* COUNTS ONLY. The money columns are deliberately not totalled here.
     They were, and the total added naira rows to dollar rows — the same fault
     as the blended server figures, reproduced in the browser. Summing them per
     currency instead would mean adding decimal strings as JavaScript floats,
     which is precisely what the server sends strings to avoid.
     The rule this file now follows is the one the ambassador money code
     already ships under: FORMAT, NEVER CALCULATE. If a money total is wanted,
     the server sends it, summed exactly, the way it sends the ambassador
     totals. */
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        active: acc.active + row.active_count,
        new: acc.new + row.new_in_period,
        churned: acc.churned + row.churned_in_period,
      }),
      { active: 0, new: 0, churned: 0 }
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
                  <MoneyCell value={row.revenue_in_period} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  <MoneyCell value={row.mrr_contribution} />
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
                <span className="text-muted-foreground">—</span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                <span className="text-muted-foreground">—</span>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

export { PlanBreakdownTable };
