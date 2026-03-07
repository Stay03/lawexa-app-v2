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
import { ArrowUpDown, CheckCircle2, XCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/utils/currency';
import type {
  AdminSubscriber,
  AdminSubscribersParams,
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

const ROLE_STYLES: Record<string, string> = {
  admin: 'text-purple-600 border-purple-200 bg-purple-50 dark:text-purple-400 dark:border-purple-900/50 dark:bg-purple-950/50',
  superadmin: 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
  researcher: 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
  user: 'text-muted-foreground border-border',
  guest: 'text-muted-foreground border-border',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminSubscribersTableProps {
  subscribers: AdminSubscriber[];
  isLoading: boolean;
  params: AdminSubscribersParams;
  onSort: (sortBy: AdminSubscribersParams['sort_by']) => void;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Subscribers table.
 */
function AdminSubscribersTable({
  subscribers,
  isLoading,
  params,
  onSort,
}: AdminSubscribersTableProps) {
  const router = useRouter();

  const handleRowClick = (uuid: string) => {
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

  if (subscribers.length === 0) {
    return (
      <div className="rounded-lg border py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Users className="h-8 w-8 opacity-40" />
          <p className="text-sm">No subscribers found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold">
              <SortButton field="name" currentSort={params.sort_by} onClick={onSort}>
                User
              </SortButton>
            </TableHead>
            <TableHead className="font-semibold">Role</TableHead>
            <TableHead className="font-semibold">Plan</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">Amount</TableHead>
            <TableHead className="font-semibold">Next Payment</TableHead>
            <TableHead className="font-semibold text-center">Access</TableHead>
            <TableHead className="font-semibold">
              <SortButton field="created_at" currentSort={params.sort_by} onClick={onSort}>
                Joined
              </SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscribers.map((sub, index) => (
            <TableRow
              key={sub.uuid}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/40',
                index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => handleRowClick(sub.uuid)}
            >
              {/* User */}
              <TableCell className="max-w-[200px]">
                <span className="block truncate font-medium text-sm">{sub.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{sub.email}</span>
              </TableCell>
              {/* Role */}
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('text-xs capitalize', ROLE_STYLES[sub.role] || ROLE_STYLES.user)}
                >
                  {sub.role}
                </Badge>
              </TableCell>
              {/* Plan */}
              <TableCell className="text-sm text-muted-foreground max-w-[120px]">
                <span className="block truncate">
                  {sub.subscription?.plan.name || '-'}
                </span>
              </TableCell>
              {/* Status */}
              <TableCell>
                {sub.subscription ? (
                  <Badge
                    variant="outline"
                    className={cn('text-xs capitalize', STATUS_STYLES[sub.subscription.status])}
                  >
                    {sub.subscription.status_label}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              {/* Amount */}
              <TableCell className="text-right tabular-nums text-sm">
                {sub.subscription ? formatNaira(Number(sub.subscription.amount)) : '-'}
              </TableCell>
              {/* Next Payment */}
              <TableCell>
                {sub.subscription?.next_payment_date ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help">
                        {formatDistanceToNow(new Date(sub.subscription.next_payment_date), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(sub.subscription.next_payment_date), 'PPpp')}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              {/* Access */}
              <TableCell className="text-center">
                {sub.subscription ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {sub.subscription.has_access ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {sub.subscription.has_access ? 'Has access' : 'No access'}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              {/* Joined */}
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
  field: AdminSubscribersParams['sort_by'];
  currentSort?: AdminSubscribersParams['sort_by'];
  onClick: (field: AdminSubscribersParams['sort_by']) => void;
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

export { AdminSubscribersTable };
