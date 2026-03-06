'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';

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
import { useInvoices } from '@/lib/hooks/useSubscriptions';

/******************************************************************************
                               Constants
******************************************************************************/

const STATUS_STYLES: Record<string, { className: string }> = {
  success: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  pending: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  failed: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Paginated invoice history table.
 */
function InvoiceTable() {
  const [page, setPage] = useState(1);
  const invoicesQuery = useInvoices({ page, per_page: 10 });
  const invoices = invoicesQuery.data?.data ?? [];
  const pagination = invoicesQuery.data?.pagination;

  // Loading
  if (invoicesQuery.isLoading) {
    return <InvoiceTableSkeleton />;
  }

  // Error
  if (invoicesQuery.isError) {
    return (
      <ErrorState
        title="Failed to load invoices"
        description="We couldn't load your invoice history."
        retry={() => invoicesQuery.refetch()}
      />
    );
  }

  // Empty
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No invoices yet"
        description="Your invoice history will appear here after your first payment."
      />
    );
  }

  // Return
  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Invoice</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Period</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const statusStyle = STATUS_STYLES[invoice.status] || STATUS_STYLES.pending;
              return (
                <TableRow key={invoice.id}>
                  <TableCell className="text-sm">
                    {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground font-mono">
                    {invoice.invoice_code.length > 20
                      ? `${invoice.invoice_code.slice(0, 20)}...`
                      : invoice.invoice_code}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {invoice.formatted_amount}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('border-0 text-xs', statusStyle.className)}>
                      {invoice.status_label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {format(new Date(invoice.period_start), 'MMM d')} –{' '}
                    {format(new Date(invoice.period_end), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
 * Skeleton loader for the invoice table.
 */
function InvoiceTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32 hidden sm:block" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-28 hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default InvoiceTable;
