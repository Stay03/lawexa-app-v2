'use client';

import { useRouter } from 'next/navigation';
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
import { Crown } from 'lucide-react';
import { formatAmount as formatOne } from '@/components/admin/ambassadors/money';
import { seriesByCurrency } from '@/components/admin/analytics/money';
import { formatNaira } from '@/lib/utils/currency';
import type { TopRevenueUserRow } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

/**
 * Either the old flat list, or one ranked list PER CURRENCY.
 *
 * ── WHY THE SHAPE HAD TO CHANGE, RATHER THAN THE FORMATTING ───────────────
 * This table's whole job is ordering people by what they paid, and across two
 * currencies there is no such order. Ranking a dollar payer against a naira
 * payer is the blended-total bug wearing a table: it silently multiplies one
 * side by the exchange rate of the day and calls the result a position. So the
 * server ranks WITHIN each currency and sends a list for each, and a busy naira
 * month can no longer push dollar payers off a leaderboard they were never on.
 *
 * The flat-array branch is the pre-change server and stops being reachable once
 * every analytics endpoint sends maps — see components/admin/analytics/money.ts
 * for why both shapes are read at all.
 */
interface TopRevenueUsersTableProps {
  data: TopRevenueUserRow[] | Record<string, TopRevenueUserRow[]>;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Top revenue users table.
 */
function TopRevenueUsersTable({ data }: TopRevenueUsersTableProps) {
  const router = useRouter();
  const groups = seriesByCurrency(data);

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Revenue Users</CardTitle>
          <CardDescription>Highest paying users in this period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Crown aria-hidden className="h-8 w-8 opacity-40" />
          <p className="text-sm">No revenue data for this period</p>
        </CardContent>
      </Card>
    );
  }

  /* One currency needs no heading — the amounts already carry their symbol, and
     a lone "NGN" label above a single table is chrome that explains nothing. */
  const labelled = groups.length > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Revenue Users</CardTitle>
        <CardDescription>
          {labelled
            ? 'Highest paying users in this period, ranked within each currency'
            : 'Highest paying users in this period'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map((group) => (
          <div key={group.currency ?? 'legacy'} className="space-y-2">
            {labelled ? (
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.currency}
              </p>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((row) => (
                  <TableRow
                    key={row.user_uuid}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => router.push(`/admin/users/${row.user_uuid}`)}
                  >
                    <TableCell className="max-w-[150px] truncate font-medium">
                      {row.user_name}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">
                      {row.user_email}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {group.currency
                        ? formatOne(group.currency, String(row.total_revenue))
                        : formatNaira(row.total_revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.invoice_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/******************************************************************************
                                 Functions
******************************************************************************/

export { TopRevenueUsersTable };
