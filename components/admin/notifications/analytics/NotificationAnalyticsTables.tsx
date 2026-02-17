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
import { formatDistanceToNow } from 'date-fns';
import type {
  RecentBroadcastRow,
  TopAdminRow,
} from '@/types/notification';

/******************************************************************************
                          Recent Broadcasts Table
******************************************************************************/

interface RecentBroadcastsTableProps {
  broadcasts: RecentBroadcastRow[];
}

const targetTypeLabels: Record<string, string> = {
  all: 'All Users',
  role: 'By Role',
  users: 'Multiple Users',
  user: 'Single User',
};

export function RecentBroadcastsTable({
  broadcasts,
}: RecentBroadcastsTableProps) {
  const router = useRouter();

  if (!broadcasts.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Broadcasts</CardTitle>
          <CardDescription>Latest broadcasts in this period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No broadcasts in this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Broadcasts</CardTitle>
        <CardDescription>Latest broadcasts in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="text-right">Recip.</TableHead>
              <TableHead className="text-right">Read</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.map((broadcast) => {
              const readRate =
                broadcast.recipients_count > 0
                  ? Math.round(
                      (broadcast.read_count / broadcast.recipients_count) * 100
                    )
                  : 0;
              return (
                <TableRow
                  key={broadcast.uuid}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/admin/notifications/${broadcast.uuid}`)
                  }
                >
                  <TableCell className="max-w-[150px] truncate font-medium">
                    {broadcast.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {targetTypeLabels[broadcast.target_type] ||
                        broadcast.target_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {broadcast.recipients_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {readRate}%
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(broadcast.created_at),
                            { addSuffix: true }
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {new Date(broadcast.created_at).toLocaleString()}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/******************************************************************************
                          Top Admins Table
******************************************************************************/

interface TopAdminsTableProps {
  admins: TopAdminRow[];
}

export function TopAdminsTable({ admins }: TopAdminsTableProps) {
  const router = useRouter();

  if (!admins.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Admins</CardTitle>
          <CardDescription>
            Most active admins by broadcast count
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No admin activity in this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Admins</CardTitle>
        <CardDescription>
          Most active admins by broadcast count
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead className="text-right">Broadcasts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin, index) => (
              <TableRow
                key={admin.uuid}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/users/${admin.uuid}`)}
              >
                <TableCell className="text-muted-foreground tabular-nums">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">{admin.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {admin.broadcasts_count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
