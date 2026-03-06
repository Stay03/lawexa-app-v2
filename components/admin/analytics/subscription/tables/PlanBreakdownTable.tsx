'use client';

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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNaira } from '@/lib/utils/currency';
import type { PlanBreakdownRow } from '@/types/admin';

interface PlanBreakdownTableProps {
  data: PlanBreakdownRow[];
}

/**
 * Default component. Plan breakdown table showing per-plan metrics.
 */
function PlanBreakdownTable({ data }: PlanBreakdownTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Breakdown</CardTitle>
          <CardDescription>Per-plan subscription metrics</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No plan data available
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
                <TableCell className="text-right tabular-nums font-mono text-xs">
                  {formatNaira(row.revenue_in_period)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono text-xs">
                  {formatNaira(row.mrr_contribution, { decimals: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { PlanBreakdownTable };
