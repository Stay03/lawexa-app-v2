'use client';

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
import type { TopViewedContentRow } from '@/types/admin';

interface TopViewedContentTableProps {
  data: TopViewedContentRow[];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function TopViewedContentTable({ data }: TopViewedContentTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Viewed Content</CardTitle>
          <CardDescription>Most viewed content by human views</CardDescription>
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
        <CardTitle>Top Viewed Content</CardTitle>
        <CardDescription>Most viewed content by human views</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-right">Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={`${row.viewable_type}-${row.viewable_id}`}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell>
                  <Badge variant="outline">{capitalize(row.viewable_type)}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{row.viewable_id}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {row.view_count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
