'use client';

import { useMemo } from 'react';
import Link from 'next/link';
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
import { Check, X as XIcon } from 'lucide-react';
import { ProcessingStatusBadge } from './ProcessingStatusBadge';
import { shortSubjectType } from './webhook-meta';
import type {
  PaystackWebhookListResponse,
  PaystackWebhookRow,
} from '@/types/admin-paystack-webhooks';

interface PaystackWebhooksTableProps {
  pages: PaystackWebhookListResponse[] | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  onLoadMore: () => void;
  onRowClick: (id: number) => void;
  selectedId: number | null;
  error: Error | null;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PaystackWebhooksTable({
  pages,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onRowClick,
  selectedId,
  error,
}: PaystackWebhooksTableProps) {
  // Cursor pages can overlap on poll boundaries — de-dupe by id (mirrors
  // ActivityFeedList).
  const rows = useMemo<PaystackWebhookRow[]>(() => {
    if (!pages) return [];
    const seen = new Set<number>();
    const out: PaystackWebhookRow[] = [];
    for (const page of pages) {
      for (const row of page.data) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [pages]);

  if (isLoading && !rows.length) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        Failed to load webhook deliveries. Please try again.
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        No webhook deliveries match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Received</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="w-[180px]">Status</TableHead>
              <TableHead className="w-[60px] text-center">Sig</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="w-[80px] text-right">Attempts</TableHead>
              <TableHead>Subject</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isSelected = row.id === selectedId;
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? 'selected' : undefined}
                  onClick={() => onRowClick(row.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="text-xs text-muted-foreground">
                    <time
                      dateTime={row.created_at}
                      title={new Date(row.created_at).toLocaleString()}
                    >
                      {formatRelative(row.created_at)}
                    </time>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.event_type}
                  </TableCell>
                  <TableCell>
                    <ProcessingStatusBadge status={row.processing_status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {row.signature_valid ? (
                      <Check className="inline h-4 w-4 text-emerald-600" />
                    ) : (
                      <XIcon className="inline h-4 w-4 text-rose-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.user ? (
                      <Link
                        href={`/admin/users/${row.user.uuid}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm hover:underline truncate inline-block max-w-[200px]"
                      >
                        {row.user.name || row.user.email || `#${row.user.id}`}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {row.processing_attempts}
                  </TableCell>
                  <TableCell>
                    {row.subject ? (
                      <span className="font-mono text-xs">
                        {shortSubjectType(row.subject.type)}#{row.subject.id}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
      {!hasNextPage && rows.length > 10 && (
        <div className="pt-2 text-center text-xs text-muted-foreground">
          End of list
        </div>
      )}
    </div>
  );
}
