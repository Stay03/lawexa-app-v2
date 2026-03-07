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
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/utils/currency';
import type { RecentSubscriptionRow } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const STATUS_STYLES: Record<string, string> = {
  active: 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  past_due: 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  cancelled: 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
  expired: 'text-muted-foreground border-border',
  trialing: 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface RecentSubscriptionsTableProps {
  data: RecentSubscriptionRow[];
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Recent subscriptions table.
 */
function RecentSubscriptionsTable({ data }: RecentSubscriptionsTableProps) {
  const router = useRouter();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Subscriptions</CardTitle>
          <CardDescription>Latest 15 subscriptions</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Clock className="h-8 w-8 opacity-40" />
          <p className="text-sm">No recent subscriptions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Subscriptions</CardTitle>
        <CardDescription>Latest 15 subscriptions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/admin/users/${row.user_uuid}`)}
              >
                <TableCell className="max-w-[150px] truncate font-medium">
                  {row.user_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.plan_name}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('text-xs capitalize', STATUS_STYLES[row.status])}
                  >
                    {row.status_label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatNaira(row.amount)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(row.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(row.created_at), 'PPpp')}
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

export { RecentSubscriptionsTable };
