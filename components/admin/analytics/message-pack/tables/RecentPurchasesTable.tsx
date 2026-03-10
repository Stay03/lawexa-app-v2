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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow, format } from 'date-fns';
import { Clock } from 'lucide-react';
import { formatNaira } from '@/lib/utils/currency';
import type { MessagePackRecentPurchaseRow } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

interface RecentPurchasesTableProps {
  data: MessagePackRecentPurchaseRow[];
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Recent purchases table for message pack analytics.
 */
function RecentPurchasesTable({ data }: RecentPurchasesTableProps) {
  const router = useRouter();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Purchases</CardTitle>
          <CardDescription>Latest completed purchases in this period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Clock className="h-8 w-8 opacity-40" />
          <p className="text-sm">No purchases in this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Purchases</CardTitle>
        <CardDescription>Latest completed purchases in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Paid At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/admin/message-packs/${row.id}`)}
              >
                <TableCell className="max-w-[150px] truncate font-medium">
                  {row.user_name || 'Unknown'}
                  {row.is_deleted && (
                    <span className="text-xs text-muted-foreground ml-1">(deleted)</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.quantity}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.messages_total.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatNaira(row.amount)}
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help whitespace-nowrap">
                        {formatDistanceToNow(new Date(row.paid_at), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(row.paid_at), 'PPpp')}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { RecentPurchasesTable };
