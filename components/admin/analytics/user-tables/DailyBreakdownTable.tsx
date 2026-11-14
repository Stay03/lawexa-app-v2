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
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';
import type { UserDailyBreakdownRow, ViewAnalyticsGranularity } from '@/types/admin';

interface DailyBreakdownTableProps {
  data: UserDailyBreakdownRow[];
  granularity: ViewAnalyticsGranularity;
}

export function DailyBreakdownTable({ data, granularity }: DailyBreakdownTableProps) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();
  const isHourly = granularity === 'hour';
  // Hourly rows cross midnight in "last 24 hours": the midnight row then names its day.
  const spansDays = isHourly && bucketsSpanDays(data.map((row) => row.date));

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
              <TableRow key={row.date}>
                <TableCell className="font-medium">
                  {isHourly ? formatDateTick(row.date, 'hour', spansDays) : formatDateTooltipLabel(row.date, 'day')}
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
