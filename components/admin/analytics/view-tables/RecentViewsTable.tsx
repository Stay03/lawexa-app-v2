'use client';

import Link from 'next/link';
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
import { viewableHref, viewableLabel } from '@/lib/utils/viewable-content';
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
          <CardDescription>Most recent human views in the period</CardDescription>
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
        <CardDescription>Most recent human views in the period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Viewer</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => {
                const label = viewableLabel(row);
                const href = viewableHref(row);
                return (
                  <TableRow key={`${row.viewed_at}-${index}`}>
                    <TableCell className="font-medium max-w-[150px] truncate">
                      {row.viewer_name || 'Anonymous'}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="shrink-0">
                          {capitalize(row.viewable_type)}
                        </Badge>
                        <span className="truncate">
                          {href ? (
                            <Link href={href} className="hover:underline text-primary">
                              {label}
                            </Link>
                          ) : (
                            label
                          )}
                        </span>
                      </div>
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
                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.viewed_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
