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
import type { TopUniversityViewRow } from '@/types/admin';

interface TopUniversitiesViewTableProps {
  data: TopUniversityViewRow[];
}

export function TopUniversitiesViewTable({ data }: TopUniversitiesViewTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Universities</CardTitle>
          <CardDescription>Universities with the most views</CardDescription>
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
        <CardTitle>Top Universities</CardTitle>
        <CardDescription>Universities with the most views</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>University</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Unique Viewers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.university}>
                <TableCell className="font-medium max-w-[250px] truncate">
                  {row.university}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.view_count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.unique_viewers.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
