'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';
import { toast } from 'sonner';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { cn } from '@/lib/utils';
import { useInvoices } from '@/lib/hooks/useSubscriptions';

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

  /** Copy invoice code to clipboard. */
  const handleCopyInvoice = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Invoice code copied to clipboard.');
  };

  // Return
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="text-sm">
                {format(new Date(invoice.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-sm font-medium">
                {invoice.formatted_amount}
              </TableCell>
              <TableCell className="text-sm">
                <span
                  className={cn(
                    invoice.status === 'success' && 'text-green-600 dark:text-green-400',
                    invoice.status === 'pending' && 'text-amber-600 dark:text-amber-400',
                    invoice.status === 'failed' && 'text-red-600 dark:text-red-400',
                  )}
                >
                  {invoice.status_label}
                </span>
              </TableCell>
              <TableCell className="text-right text-sm">
                <button
                  className="cursor-pointer text-sm font-medium text-primary hover:underline"
                  onClick={() => handleCopyInvoice(invoice.invoice_code)}
                >
                  View
                </button>
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
 * Skeleton loader for the invoice table.
 */
function InvoiceTableSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default InvoiceTable;
