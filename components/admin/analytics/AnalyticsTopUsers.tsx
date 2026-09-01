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
import { formatDistanceToNow, format } from 'date-fns';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type { AnalyticsTopUser } from '@/types/admin';

interface AnalyticsTopUsersProps {
  users: AnalyticsTopUser[];
}

/**
 * Default component. Top users table for the analytics dashboard.
 */
function AnalyticsTopUsers({ users }: AnalyticsTopUsersProps) {
  const router = useRouter();
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();

  if (!users.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Users</CardTitle>
          <CardDescription>Most active users in this period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No user activity in this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Users</CardTitle>
        <CardDescription>Most active users in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Convs</TableHead>
              <TableHead className="text-right">Msgs</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.uuid}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/users/${user.uuid}`)}
              >
                <TableCell className="max-w-[150px] truncate font-medium">
                  {user.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {user.conversations_count}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {user.total_messages}
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono text-xs">
                  {formatCost(user.total_cost, {
                    showNGN,
                    exchangeRate,
                    decimals: 4,
                  })}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(user.last_active), {
                          addSuffix: true,
                        })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(user.last_active), 'PPpp')}
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

export { AnalyticsTopUsers };
