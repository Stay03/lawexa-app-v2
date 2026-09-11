'use client';

import type { ReactNode } from 'react';

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
import { SortButton } from './SortButton';
import type { ApplicationSortColumn, ApplicationsSort } from './applications';

const statusVariant: Record<AmbassadorStatus, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

interface AmbassadorsTableProps {
  applications: AmbassadorApplication[];
  isLoading: boolean;
  onReview: (application: AmbassadorApplication) => void;
  sort: ApplicationsSort;
  onSort: (column: ApplicationSortColumn) => void;
  /** What an empty table says. The caller words it: "no applications yet" and
   *  "nothing matches these filters" are different answers, and only the
   *  second comes with a way out. */
  empty: ReactNode;
}

function ariaSort(sort: ApplicationsSort, column: ApplicationSortColumn) {
  if (sort.column !== column) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

function SortableHead({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: ApplicationSortColumn;
  sort: ApplicationsSort;
  onSort: (column: ApplicationSortColumn) => void;
}) {
  return (
    <TableHead aria-sort={ariaSort(sort, column)}>
      <SortButton
        label={label}
        align="start"
        active={sort.column === column}
        direction={sort.direction}
        onClick={() => onSort(column)}
      />
    </TableHead>
  );
}

/**
 * One page of ambassador applications. The page does the filtering, sorting and
 * paging; this draws the rows it is handed.
 *
 * Every column a sort can use is on screen, Reviewed included, so an order is
 * never a mystery.
 */
export function AmbassadorsTable({
  applications,
  isLoading,
  onReview,
  sort,
  onSort,
  empty,
}: AmbassadorsTableProps) {
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
    return <div className="py-12 text-center text-sm text-muted-foreground">{empty}</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead label="Applicant" column="name" sort={sort} onSort={onSort} />
            <TableHead>Campus</TableHead>
            <TableHead>Level</TableHead>
            <SortableHead label="Status" column="status" sort={sort} onSort={onSort} />
            <SortableHead label="Submitted" column="submitted" sort={sort} onSort={onSort} />
            <SortableHead label="Reviewed" column="reviewed" sort={sort} onSort={onSort} />
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
              <TableCell className="text-sm text-muted-foreground">
                {a.reviewed_at ? (
                  <>
                    <div>{new Date(a.reviewed_at).toLocaleDateString()}</div>
                    {a.reviewed_by && <div className="text-xs">{a.reviewed_by.name}</div>}
                  </>
                ) : (
                  '—'
                )}
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
