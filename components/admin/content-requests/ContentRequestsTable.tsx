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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowUpDown,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Edit,
  User,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { ContentRequestStatusBadge } from '@/components/content-requests/ContentRequestStatusBadge';
import type { ContentRequest, AdminContentRequestsParams } from '@/types/content-request';

/******************************************************************************
                                Component Props
******************************************************************************/

interface ContentRequestsTableProps {
  requests: ContentRequest[];
  isLoading: boolean;
  params: AdminContentRequestsParams;
  onSort: (sortBy: 'created_at' | 'updated_at') => void;
  onUpdateStatus: (request: ContentRequest) => void;
  onFulfill: (request: ContentRequest) => void;
  onReject: (request: ContentRequest) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Table component for content requests list
 * Shows user, type, title, status, date, and actions
 */
export function ContentRequestsTable({
  requests,
  isLoading,
  params,
  onSort,
  onUpdateStatus,
  onFulfill,
  onReject,
}: ContentRequestsTableProps) {
  const router = useRouter();

  const handleRowClick = (uuid: string) => {
    // For now, we'll just prevent navigation since we don't have detail page yet
    // Future: router.push(`/admin/content-requests/${uuid}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: 'created_at' | 'updated_at';
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
          params.sort === field && 'text-primary'
        )}
      />
    </Button>
  );

  // Type badge helper
  const getTypeBadge = (type: string) => {
    const config = {
      case: { label: 'Case', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      note: { label: 'Note', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
      statute: { label: 'Statute', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
      provision: { label: 'Provision', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    };

    const typeConfig = config[type as keyof typeof config] || { label: type, className: '' };

    return (
      <Badge variant="outline" className={typeConfig.className}>
        {typeConfig.label}
      </Badge>
    );
  };

  // Loading State with fading skeleton
  if (isLoading) {
    const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];

    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[200px] font-semibold">User</TableHead>
              <TableHead className="w-[100px] font-semibold">Type</TableHead>
              <TableHead className="w-[300px] font-semibold">Title</TableHead>
              <TableHead className="w-[130px] font-semibold">Status</TableHead>
              <TableHead className="w-[150px] font-semibold">
                <SortButton field="created_at">Requested</SortButton>
              </TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => {
              const opacity = opacityValues[i] ?? 0.25;

              return (
                <TableRow
                  key={i}
                  className={cn(i % 2 === 1 && 'bg-muted/20')}
                  style={{ opacity }}
                >
                  <TableCell>
                    <Skeleton className="h-4 w-32 animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24 animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Empty State
  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[200px] font-semibold">User</TableHead>
              <TableHead className="w-[100px] font-semibold">Type</TableHead>
              <TableHead className="w-[300px] font-semibold">Title</TableHead>
              <TableHead className="w-[130px] font-semibold">Status</TableHead>
              <TableHead className="w-[150px] font-semibold">
                <SortButton field="created_at">Requested</SortButton>
              </TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No content requests found
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  // Data Rows
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[200px] font-semibold">User</TableHead>
            <TableHead className="w-[100px] font-semibold">Type</TableHead>
            <TableHead className="w-[300px] font-semibold">Title</TableHead>
            <TableHead className="w-[130px] font-semibold">Status</TableHead>
            <TableHead className="w-[150px] font-semibold">
              <SortButton field="created_at">Requested</SortButton>
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request, index) => (
            <TableRow
              key={request.uuid}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
            >
              {/* User */}
              <TableCell className="max-w-[200px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {request.user?.name || 'Unknown'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">{request.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{request.user?.email}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Type */}
              <TableCell>
                {getTypeBadge(request.type)}
              </TableCell>

              {/* Title */}
              <TableCell className="max-w-[300px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="truncate font-medium">
                      {request.title}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="font-semibold">{request.title}</p>
                    {request.additional_notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.additional_notes}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Status */}
              <TableCell>
                <ContentRequestStatusBadge status={request.status} />
              </TableCell>

              {/* Requested Date */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {format(new Date(request.created_at), 'PPpp')}
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Actions */}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onUpdateStatus(request)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Update Status
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onFulfill(request)}
                      disabled={request.status === 'fulfilled' || request.status === 'rejected'}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Fulfill
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onReject(request)}
                      disabled={request.status === 'fulfilled' || request.status === 'rejected'}
                      className="text-destructive focus:text-destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
