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
import { formatNaira } from '@/lib/utils/currency';
import type { TopRevenueUserRow } from '@/types/admin';

interface TopRevenueUsersTableProps {
  data: TopRevenueUserRow[];
}

/**
 * Default component. Top revenue users table.
 */
function TopRevenueUsersTable({ data }: TopRevenueUsersTableProps) {
  const router = useRouter();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Revenue Users</CardTitle>
          <CardDescription>Highest paying users in this period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No revenue data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Revenue Users</CardTitle>
        <CardDescription>Highest paying users in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Invoices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.user_uuid}
                className="cursor-pointer"
                onClick={() => router.push(`/admin/users/${row.user_uuid}`)}
              >
                <TableCell className="max-w-[150px] truncate font-medium">
                  {row.user_name}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">
                  {row.user_email}
                </TableCell>
                <TableCell className="text-right tabular-nums font-mono text-xs">
                  {formatNaira(row.total_revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.invoice_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { TopRevenueUsersTable };
