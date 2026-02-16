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
import type { TopSearchQueryRow } from '@/types/admin';

interface TopSearchQueriesTableProps {
  data: TopSearchQueryRow[];
}

export function TopSearchQueriesTable({ data }: TopSearchQueriesTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Search Queries</CardTitle>
          <CardDescription>Most common internal search queries</CardDescription>
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
        <CardTitle>Top Search Queries</CardTitle>
        <CardDescription>Most common internal search queries</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Query</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={row.search_query}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="font-medium">{row.search_query}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
