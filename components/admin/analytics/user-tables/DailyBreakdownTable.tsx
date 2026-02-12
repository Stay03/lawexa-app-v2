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
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { UserDailyBreakdownRow } from '@/types/admin';

interface DailyBreakdownTableProps {
  data: UserDailyBreakdownRow[];
}

export function DailyBreakdownTable({ data }: DailyBreakdownTableProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
          <CardDescription>Comprehensive daily metrics</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Breakdown</CardTitle>
        <CardDescription>Comprehensive daily metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">New Users</TableHead>
              <TableHead className="text-right">Conversations</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="text-right">AI Responses</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.date}>
                <TableCell className="font-medium">
                  {new Date(row.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.new_users}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.conversations}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.messages}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.ai_responses}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.total_tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono">
                  {formatCost(row.cost, { showNGN, exchangeRate, decimals: 4 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
