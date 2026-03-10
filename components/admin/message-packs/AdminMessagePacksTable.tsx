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
import { ArrowUpDown, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/utils/currency';
import type {
  AdminMessagePackListItem,
  AdminMessagePacksParams,
} from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  pending: 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  failed: 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
  refunded: 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminMessagePacksTableProps {
  messagePacks: AdminMessagePackListItem[];
  isLoading: boolean;
  params: AdminMessagePacksParams;
  onSort: (sortBy: AdminMessagePacksParams['sort_by']) => void;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Sortable table for the admin message packs list.
 */
function AdminMessagePacksTable({
  messagePacks,
  isLoading,
  params,
  onSort,
}: AdminMessagePacksTableProps) {
  const router = useRouter();

  const handleRowClick = (id: number) => {
    router.push(`/admin/message-packs/${id}`);
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

  if (messagePacks.length === 0) {
    return (
      <div className="rounded-lg border py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Table2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No message packs found</p>
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
            <TableHead className="font-semibold text-right">Qty</TableHead>
            <TableHead className="font-semibold">
              <SortButton field="messages_total" currentSort={params.sort_by} onClick={onSort}>
                Messages
              </SortButton>
            </TableHead>
            <TableHead className="font-semibold text-right">
              <SortButton field="amount" currentSort={params.sort_by} onClick={onSort}>
                Amount
              </SortButton>
            </TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">
              <SortButton field="paid_at" currentSort={params.sort_by} onClick={onSort}>
                Paid At
              </SortButton>
            </TableHead>
            <TableHead className="font-semibold">
              <SortButton field="created_at" currentSort={params.sort_by} onClick={onSort}>
                Created
              </SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messagePacks.map((pack, index) => (
            <TableRow
              key={pack.id}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/40',
                index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => handleRowClick(pack.id)}
            >
              {/* User */}
              <TableCell className="max-w-[180px]">
                <button
                  type="button"
                  onClick={(e) => handleUserClick(e, pack.user.uuid)}
                  className="text-left hover:underline transition-colors"
                >
                  <span className="block truncate font-medium text-sm">{pack.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{pack.user.email}</span>
                </button>
              </TableCell>
              {/* Qty */}
              <TableCell className="text-right tabular-nums text-sm">
                {pack.quantity}
              </TableCell>
              {/* Messages */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm tabular-nums cursor-help">
                      {pack.messages_consumed}/{pack.messages_total}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {pack.messages_remaining} remaining
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              {/* Amount */}
              <TableCell className="text-right tabular-nums text-sm">
                {formatNaira(pack.amount)}
              </TableCell>
              {/* Status */}
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('text-xs capitalize', STATUS_STYLES[pack.status])}
                >
                  {pack.status_label}
                </Badge>
              </TableCell>
              {/* Paid At */}
              <TableCell>
                {pack.paid_at ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-help whitespace-nowrap">
                        {formatDistanceToNow(new Date(pack.paid_at), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(pack.paid_at), 'PPpp')}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              {/* Created */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-muted-foreground cursor-help whitespace-nowrap">
                      {formatDistanceToNow(new Date(pack.created_at), { addSuffix: true })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {format(new Date(pack.created_at), 'PPpp')}
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
  field: AdminMessagePacksParams['sort_by'];
  currentSort?: AdminMessagePacksParams['sort_by'];
  onClick: (field: AdminMessagePacksParams['sort_by']) => void;
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

export { AdminMessagePacksTable };
