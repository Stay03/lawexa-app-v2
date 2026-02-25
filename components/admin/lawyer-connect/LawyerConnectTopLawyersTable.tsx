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
import { Badge } from '@/components/ui/badge';
import type { LawyerConnectTopLawyer } from '@/types/admin-lawyer-connect';

interface LawyerConnectTopLawyersTableProps {
  lawyers: LawyerConnectTopLawyer[];
}

export function LawyerConnectTopLawyersTable({
  lawyers,
}: LawyerConnectTopLawyersTableProps) {
  const router = useRouter();

  if (!lawyers.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Lawyers</CardTitle>
          <CardDescription>
            Most contacted lawyers in this period
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No lawyer activity in this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Lawyers</CardTitle>
        <CardDescription>Most contacted lawyers in this period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead>Lawyer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lawyers.map((lawyer, index) => (
              <TableRow
                key={lawyer.uuid}
                className="cursor-pointer"
                onClick={() =>
                  router.push(`/admin/lawyer-connect/lawyer/${lawyer.uuid}`)
                }
              >
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {lawyer.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {lawyer.total_requests}
                </TableCell>
                <TableCell className="text-right">
                  {lawyer.pending_requests > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50"
                    >
                      {lawyer.pending_requests}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
