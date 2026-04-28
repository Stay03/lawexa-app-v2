'use client';

import Link from 'next/link';
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
import type { TopViewerRow } from '@/types/admin';

interface TopViewersTableProps {
  data: TopViewerRow[];
}

export function TopViewersTable({ data }: TopViewersTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Viewers</CardTitle>
          <CardDescription>Most active human viewers</CardDescription>
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
        <CardTitle>Top Viewers</CardTitle>
        <CardDescription>Most active human viewers</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead className="text-right">Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={row.is_guest ? `guest-${index}-${row.name}` : row.uuid}>
                <TableCell className="font-medium">
                  {row.is_guest ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="truncate">{row.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        Guest
                      </Badge>
                    </span>
                  ) : (
                    <Link
                      href={`/admin/users/${row.uuid}`}
                      className="hover:underline text-primary"
                    >
                      {row.name}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[180px] truncate">
                  {row.email || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.profession || (row.is_guest ? '—' : 'N/A')}
                </TableCell>
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
