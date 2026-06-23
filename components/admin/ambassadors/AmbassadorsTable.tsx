'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AmbassadorApplication, AmbassadorStatus } from '@/types/ambassador';

const statusVariant: Record<AmbassadorStatus, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

interface AmbassadorsTableProps {
  applications: AmbassadorApplication[];
  isLoading: boolean;
  onReview: (application: AmbassadorApplication) => void;
}

export function AmbassadorsTable({ applications, isLoading, onReview }: AmbassadorsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!applications.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No ambassador applications found.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Applicant</TableHead>
            <TableHead>Campus</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((a) => (
            <TableRow key={a.uuid}>
              <TableCell>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.email}</div>
              </TableCell>
              <TableCell>
                <div>{a.university || '—'}</div>
                {a.country && <div className="text-xs text-muted-foreground">{a.country}</div>}
              </TableCell>
              <TableCell>{a.level || '—'}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[a.status]}>{a.status_label || a.status}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => onReview(a)}>
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
