'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ObservabilityColumn {
  key: string;
  label: React.ReactNode;
  className?: string;
}

interface ObservabilityTableProps {
  columns: ObservabilityColumn[];
  isLoading: boolean;
  isEmpty: boolean;
  emptyText?: string;
  skeletonRows?: number;
  children: React.ReactNode;
}

/**
 * Shared table shell for observability lists: consistent header styling,
 * fading skeleton rows while loading, and a spanning empty state — so each
 * domain table only has to render its data rows.
 */
export function ObservabilityTable({
  columns,
  isLoading,
  isEmpty,
  emptyText = 'No records found',
  skeletonRows = 6,
  children,
}: ObservabilityTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((col) => (
              <TableHead key={col.key} className={cn('font-semibold', col.className)}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={i} style={{ opacity: [1, 0.8, 0.6, 0.4, 0.25, 0.1][i] ?? 0.1 }}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : isEmpty ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-12 text-center text-muted-foreground"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      </Table>
    </div>
  );
}
