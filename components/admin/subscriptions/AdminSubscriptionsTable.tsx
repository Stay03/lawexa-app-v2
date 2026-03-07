'use client';

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowUpDown, CheckCircle2, XCircle, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/utils/currency';
import type {
  AdminSubscriptionListItem,
  AdminSubscriptionsParams,
} from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const STATUS_STYLES: Record<string, string> = {
  active: 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  past_due: 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  cancelled: 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
  expired: 'text-muted-foreground border-border',
  trialing: 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminSubscriptionsTableProps {
  subscriptions: AdminSubscriptionListItem[];
  isLoading: boolean;
  params: AdminSubscriptionsParams;
  onSort: (sortBy: AdminSubscriptionsParams['sort_by']) => void;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Sortable table for the admin subscriptions list.
 */
function AdminSubscriptionsTable({
  subscriptions,
  isLoading,
  params,
  onSort,
}: AdminSubscriptionsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: number) => {
    router.push(`/admin/subscriptions/${id}`);
  };

  const handleUserClick = (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    router.push(`/admin/users/${uuid}`);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[600px]" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-lg border py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Table2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No subscriptions found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">User</TableHead>
            <TableHead className="font-semibold">Plan</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">
              <SortButton field="amount" currentSort={params.sort_by} onClick={onSort}>
                Amount
              </SortButton>
            </TableHead>
            <TableHead className="font-semibold">
              <SortButton field="start_date" currentSort={params.sort_by} onClick={onSort}>
                Started
              </SortButton>
            </TableHead>
            <TableHead className="font-semibold">
              <SortButton field="next_payment_date" currentSort={params.sort_by} onClick={onSort}>
                Next Payment
              </SortButton>
            </TableHead>
            <TableHead className="font-semibold text-center">Access</TableHead>
            <TableHead className="font-semibold text-right">Invoices</TableHead>
            <TableHead className="font-semibold">
              <SortButton field="created_at" currentSort={params.sort_by} onClick={onSort}>
                Created
              </SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub, index) => (
            <TableRow
              key={sub.id}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/40',
                index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => handleRowClick(sub.id)}
            >
              {/* User */}
              <TableCell className="max-w-[180px]">
                <button
                  type="button"
                  onClick={(e) => handleUserClick(e, sub.user.uuid)}
                  className="text-left hover:underline transition-colors"
                >
                  <span className="block truncate font-medium text-sm">{sub.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{sub.user.email}</span>
                </button>
              </TableCell>
              {/* Plan */}
              <TableCell className="text-sm text-muted-foreground max-w-[120px]">
                <span className="block truncate">{sub.plan.name}</span>
              </TableCell>
              {/* Status */}
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('text-xs capitalize', STATUS_STYLES[sub.status])}
                >
                  {sub.status_label}
                </Badge>
              </TableCell>
              {/* Amount */}
              <TableCell className="text-right tabular-nums text-sm">
                {formatNaira(Number(sub.amount))}
              </TableCell>
              {/* Start Date */}
              <TableCell>
                {sub.start_date ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help">
                        {format(new Date(sub.start_date), 'MMM d, yyyy')}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(sub.start_date), 'PPpp')}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              {/* Next Payment */}
              <TableCell>
                {sub.next_payment_date ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help">
                        {formatDistanceToNow(new Date(sub.next_payment_date), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(sub.next_payment_date), 'PPpp')}</p>
                      {sub.days_until_renewal !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {sub.days_until_renewal} days until renewal
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              {/* Access */}
              <TableCell className="text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {sub.has_access ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {sub.has_access ? 'Has access' : 'No access'}
                    {sub.is_in_grace_period && ' (grace period)'}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              {/* Invoices */}
              <TableCell className="text-right tabular-nums text-sm">
                {sub.invoices_count}
              </TableCell>
              {/* Created */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-muted-foreground cursor-help whitespace-nowrap">
                      {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {format(new Date(sub.created_at), 'PPpp')}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/******************************************************************************
                                 Functions
******************************************************************************/

/** Sort button for table headers. */
function SortButton({
  field,
  currentSort,
  onClick,
  children,
}: {
  field: AdminSubscriptionsParams['sort_by'];
  currentSort?: AdminSubscriptionsParams['sort_by'];
  onClick: (field: AdminSubscriptionsParams['sort_by']) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={(e) => {
        e.stopPropagation();
        onClick(field);
      }}
    >
      {children}
      <ArrowUpDown
        className={cn('ml-2 h-4 w-4', currentSort === field && 'text-primary')}
      />
    </Button>
  );
}

export { AdminSubscriptionsTable };
