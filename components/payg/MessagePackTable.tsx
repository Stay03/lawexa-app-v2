'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Package } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { cn } from '@/lib/utils';
import { useMessagePacks } from '@/lib/hooks/useMessagePacks';
import type { TMessagePackStatus } from '@/types/message-pack';

/******************************************************************************
                               Constants
******************************************************************************/

const STATUS_STYLES: Record<TMessagePackStatus, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Paginated message pack purchase history table.
 */
function MessagePackTable() {
  const [page, setPage] = useState(1);
  const packsQuery = useMessagePacks({ page, per_page: 10 });
  const packs = packsQuery.data?.data ?? [];
  const pagination = packsQuery.data?.pagination;

  // Loading
  if (packsQuery.isLoading) {
    return <MessagePackTableSkeleton />;
  }

  // Error
  if (packsQuery.isError) {
    return (
      <ErrorState
        title="Failed to load purchase history"
        description="We couldn't load your message pack history."
        retry={() => packsQuery.refetch()}
      />
    );
  }

  // Empty
  if (packs.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No message packs yet"
        description="Your purchase history will appear here after your first message pack purchase."
      />
    );
  }

  // Return
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Packs</TableHead>
            <TableHead>Messages</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packs.map((pack) => (
            <TableRow key={pack.id}>
              <TableCell className="text-sm">
                {format(new Date(pack.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-sm">{pack.quantity}</TableCell>
              <TableCell className="text-sm">
                {pack.status === 'completed'
                  ? `${pack.messages_remaining} / ${pack.messages_total}`
                  : pack.messages_total}
              </TableCell>
              <TableCell className="text-sm font-medium">
                {pack.formatted_amount}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={cn(
                    'border-0 text-xs',
                    STATUS_STYLES[pack.status]
                  )}
                >
                  {pack.status_label}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.current_page} of {pagination.last_page}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton loader for the message pack table.
 */
function MessagePackTableSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default MessagePackTable;
