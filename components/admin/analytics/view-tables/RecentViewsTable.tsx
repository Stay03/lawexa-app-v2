'use client';

import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
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
import type { RecentViewRow } from '@/types/admin';

interface RecentViewsTableProps {
  data: RecentViewRow[];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function RecentViewsTable({ data }: RecentViewsTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Views</CardTitle>
          <CardDescription>Most recent views in the period</CardDescription>
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
        <CardTitle>Recent Views</CardTitle>
        <CardDescription>Most recent views in the period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Viewer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow key={`${row.viewed_at}-${index}`}>
                  <TableCell className="font-medium max-w-[150px] truncate">
                    {row.viewer_name || 'Anonymous'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{capitalize(row.viewable_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.device_type ? capitalize(row.device_type) : 'N/A'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.browser || 'N/A'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.ip_country || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {row.is_bot ? (
                      <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50">
                        Bot
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50">
                        Human
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.viewed_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
