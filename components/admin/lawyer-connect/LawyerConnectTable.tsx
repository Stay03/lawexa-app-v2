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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowUpDown, Phone, Mail, CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LawyerConnectionRequest } from '@/types/connection';
import type {
  LawyerConnectStatus,
  AdminLawyerConnectListParams,
} from '@/types/admin-lawyer-connect';

interface LawyerConnectTableProps {
  requests: LawyerConnectionRequest[];
  isLoading: boolean;
  params: AdminLawyerConnectListParams;
  onSort: (sortBy: 'created_at' | 'updated_at' | 'status') => void;
  hideLawyerColumn?: boolean;
}

function StatusBadge({ status }: { status: LawyerConnectStatus }) {
  const config = {
    pending: {
      label: 'Pending',
      className:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50',
    },
    accepted: {
      label: 'Accepted',
      className:
        'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900/50',
    },
    rejected: {
      label: 'Rejected',
      className:
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50',
    },
  };
  const { label, className } = config[status] ?? config.pending;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  );
}

export function LawyerConnectTable({
  requests,
  isLoading,
  params,
  onSort,
  hideLawyerColumn = false,
}: LawyerConnectTableProps) {
  const router = useRouter();

  const handleRowClick = (id: number) => {
    router.push(`/admin/lawyer-connect/${id}`);
  };

  const handleUserClick = (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    router.push(`/admin/users/${uuid}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: 'created_at' | 'updated_at' | 'status';
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown
        className={cn(
          'ml-2 h-4 w-4',
          params.sort_by === field && 'text-primary'
        )}
      />
    </Button>
  );

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

  if (requests.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No connection requests found
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[200px] font-semibold">Client</TableHead>
            {!hideLawyerColumn && (
              <TableHead className="w-[200px] font-semibold">Lawyer</TableHead>
            )}
            <TableHead className="w-[180px] font-semibold">Contact</TableHead>
            <TableHead className="font-semibold">Message</TableHead>
            <TableHead className="w-[110px] font-semibold">
              <SortButton field="status">Status</SortButton>
            </TableHead>
            <TableHead className="w-[150px] font-semibold">
              <SortButton field="created_at">Date</SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request, index) => (
            <TableRow
              key={request.id}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/40',
                index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => handleRowClick(request.id)}
            >
              {/* Client */}
              <TableCell>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={(e) => handleUserClick(e, request.user.uuid)}
                    className="block font-medium text-sm hover:text-primary hover:underline transition-colors cursor-pointer text-left"
                  >
                    {request.user.name}
                  </button>
                  <span className="block text-xs text-muted-foreground truncate max-w-[180px]">
                    {request.user.email}
                  </span>
                </div>
              </TableCell>

              {/* Lawyer */}
              {!hideLawyerColumn && (
                <TableCell>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={(e) => handleUserClick(e, request.lawyer.uuid)}
                      className="block font-medium text-sm hover:text-primary hover:underline transition-colors cursor-pointer text-left"
                    >
                      {request.lawyer.name}
                    </button>
                    <span className="block text-xs text-muted-foreground truncate max-w-[180px]">
                      {request.lawyer.email}
                    </span>
                  </div>
                </TableCell>
              )}

              {/* Contact */}
              <TableCell>
                <div className="space-y-1">
                  {request.phone_number ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {request.phone_number}
                      </span>
                    </span>
                  ) : null}
                  {request.contact_email ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {request.contact_email}
                      </span>
                    </span>
                  ) : null}
                  {!request.phone_number && !request.contact_email && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>

              {/* Message */}
              <TableCell>
                {request.message ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block text-sm text-muted-foreground cursor-help truncate max-w-[260px]">
                        {request.message}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[320px] whitespace-pre-wrap"
                    >
                      {request.message}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* Status */}
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>

              {/* Date */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(request.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(request.created_at), 'PPpp')}</p>
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

export { StatusBadge };
