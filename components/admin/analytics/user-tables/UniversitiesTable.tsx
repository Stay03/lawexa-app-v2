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
import type { UserUniversityRow } from '@/types/admin';

interface UniversitiesTableProps {
  title: string;
  description: string;
  data: UserUniversityRow[];
}

export function UniversitiesTable({
  title,
  description,
  data,
}: UniversitiesTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
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
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>University</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={`${row.university}-${row.country}`}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {row.university}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.country || 'N/A'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.count}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.percentage.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
