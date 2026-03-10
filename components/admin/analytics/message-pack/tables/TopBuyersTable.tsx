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
import { formatNaira } from '@/lib/utils/currency';
import type { MessagePackTopBuyerRow } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

interface TopBuyersTableProps {
  data: MessagePackTopBuyerRow[];
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Top buyers table for message pack analytics.
 */
function TopBuyersTable({ data }: TopBuyersTableProps) {
  const router = useRouter();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Buyers</CardTitle>
          <CardDescription>Highest spending users in this period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Crown className="h-8 w-8 opacity-40" />
          <p className="text-sm">No purchase data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Buyers</CardTitle>
        <CardDescription>Highest spending users in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="text-right">Packs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.user_uuid}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/admin/users/${row.user_uuid}`)}
              >
                <TableCell className="max-w-[150px] truncate font-medium">
                  {row.user_name || 'Unknown'}
                  {row.is_deleted && (
                    <span className="text-xs text-muted-foreground ml-1">(deleted)</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">
                  {row.user_email || '-'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatNaira(row.total_spent)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.total_messages.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.pack_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { TopBuyersTable };
