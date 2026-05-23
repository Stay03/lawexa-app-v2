'use client';

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
import { Receipt, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatMoneyMinor } from '@/lib/utils/payment-format';
import type { AdminSubscriptionInvoice } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const INVOICE_STATUS_STYLES: Record<string, string> = {
  success: 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  pending: 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  failed: 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminSubscriptionInvoicesTableProps {
  invoices: AdminSubscriptionInvoice[];
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Invoices table for subscription detail.
 */
function AdminSubscriptionInvoicesTable({ invoices }: AdminSubscriptionInvoicesTableProps) {
  if (!invoices.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Up to 10 most recent invoices</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex h-[120px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Receipt className="h-8 w-8 opacity-40" />
          <p className="text-sm">No invoices yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Up to 10 most recent invoices</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Paid At</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-xs">
                  {inv.invoice_code}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('text-xs capitalize', INVOICE_STATUS_STYLES[inv.status])}
                  >
                    {inv.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {inv.paid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {formatMoneyMinor(inv.amount_minor, inv.currency)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {inv.period_start && inv.period_end
                    ? `${inv.period_start} — ${inv.period_end}`
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {inv.paid_at
                    ? format(new Date(inv.paid_at), 'MMM d, yyyy')
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(inv.created_at), 'MMM d, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { AdminSubscriptionInvoicesTable };
