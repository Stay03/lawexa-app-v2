'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminQuizBatchStatusBadge } from './AdminQuizBatchStatusBadge';
import {
  formatCount,
  formatDurationMs,
  formatSessionDate,
  formatTokenCost,
} from '@/lib/utils/quiz-format';
import type { AdminQuizBatchListItem } from '@/types/admin-quiz';

interface AdminQuizBatchesTableProps {
  batches: AdminQuizBatchListItem[];
  isLoading: boolean;
}

export function AdminQuizBatchesTable({
  batches,
  isLoading,
}: AdminQuizBatchesTableProps) {
  if (isLoading) return <TableSkeleton />;

  if (batches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No batches in this range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead className="hidden capitalize sm:table-cell">Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Questions</TableHead>
            <TableHead className="hidden text-right md:table-cell">Tokens</TableHead>
            <TableHead className="hidden text-right md:table-cell">Cost</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Duration</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => (
            <TableRow key={b.uuid}>
              <TableCell>
                <Link
                  href={`/admin/quiz/generation/${b.uuid}`}
                  className="font-medium hover:underline"
                >
                  {b.user?.name ?? 'Batch'}
                </Link>
              </TableCell>
              <TableCell className="hidden text-sm capitalize text-muted-foreground sm:table-cell">
                {b.source_mode}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <AdminQuizBatchStatusBadge status={b.status} />
                  {b.error && (
                    <AlertTriangle
                      className="h-3.5 w-3.5 text-destructive"
                      aria-label="Batch error"
                    />
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatCount(b.questions_generated)}
              </TableCell>
              <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground md:table-cell">
                {formatCount(b.total_tokens)}
              </TableCell>
              <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground md:table-cell">
                {formatTokenCost(b.token_cost)}
              </TableCell>
              <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground lg:table-cell">
                {b.duration_ms == null ? '—' : formatDurationMs(b.duration_ms)}
              </TableCell>
              <TableCell className="hidden text-right text-sm text-muted-foreground lg:table-cell">
                {formatSessionDate(b.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
