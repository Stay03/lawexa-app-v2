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
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type { UserDailyBreakdownRow, ViewAnalyticsGranularity } from '@/types/admin';

interface DailyBreakdownTableProps {
  data: UserDailyBreakdownRow[];
  granularity: ViewAnalyticsGranularity;
}

function formatHour(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function DailyBreakdownTable({ data, granularity }: DailyBreakdownTableProps) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();
  const isHourly = granularity === 'hour';

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
          <CardDescription>Comprehensive metrics</CardDescription>
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
        <CardTitle>Breakdown</CardTitle>
        <CardDescription>Comprehensive metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isHourly ? 'Hour' : 'Date'}</TableHead>
              <TableHead className="text-right">New Registered</TableHead>
              <TableHead className="text-right">New Guests</TableHead>
              <TableHead className="text-right">Conversations</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="text-right">AI Responses</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.hour ?? row.date}>
                <TableCell className="font-medium">
                  {isHourly
                    ? formatHour(row.hour!)
                    : new Date(row.date!).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.new_users - row.new_guests}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.new_guests}
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
