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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Broadcast, BroadcastListParams, BroadcastTargetType } from '@/types/notification';

/******************************************************************************
                                Types
******************************************************************************/

interface BroadcastsTableProps {
  broadcasts: Broadcast[];
  isLoading: boolean;
  params: BroadcastListParams;
  onSort: (sortBy: 'created_at' | 'recipients_count' | 'title') => void;
}

/******************************************************************************
                                Helpers
******************************************************************************/

const targetTypeLabels: Record<BroadcastTargetType, string> = {
  all: 'All Users',
  role: 'By Role',
  users: 'Multiple Users',
  user: 'Single User',
};

const targetTypeVariants: Record<BroadcastTargetType, 'default' | 'secondary' | 'outline'> = {
  all: 'default',
  role: 'secondary',
  users: 'outline',
  user: 'outline',
};

function getReadRatePercent(broadcast: Broadcast): number {
  if (broadcast.recipients_count === 0) return 0;
  return Math.round((broadcast.read_count / broadcast.recipients_count) * 100);
}

/******************************************************************************
                                Component
******************************************************************************/

export function BroadcastsTable({
  broadcasts,
  isLoading,
  params,
  onSort,
}: BroadcastsTableProps) {
  const router = useRouter();

  const handleRowClick = (uuid: string) => {
    router.push(`/admin/notifications/${uuid}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: 'created_at' | 'recipients_count' | 'title';
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
        className={cn('ml-2 h-4 w-4', params.sort === field && 'text-primary')}
      />
    </Button>
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[600px]" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-4 border-t">
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No broadcasts found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>
              <SortButton field="title">Title</SortButton>
            </TableHead>
            <TableHead>Target</TableHead>
            <TableHead className="text-right">
              <SortButton field="recipients_count">Recipients</SortButton>
            </TableHead>
            <TableHead className="text-right">Read Rate</TableHead>
            <TableHead>Sent By</TableHead>
            <TableHead>
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {broadcasts.map((broadcast, index) => (
            <TableRow
              key={broadcast.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => handleRowClick(broadcast.id)}
            >
              <TableCell className="max-w-[250px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium truncate block">
                      {broadcast.title}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[300px]">
                    <p className="text-sm">{broadcast.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {broadcast.message}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Badge variant={targetTypeVariants[broadcast.target_type]}>
                  {targetTypeLabels[broadcast.target_type]}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {broadcast.recipients_count.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tabular-nums">
                      {getReadRatePercent(broadcast)}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {broadcast.read_count.toLocaleString()} read / {broadcast.unread_count.toLocaleString()} unread
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {broadcast.admin.name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      {formatDistanceToNow(new Date(broadcast.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {new Date(broadcast.created_at).toLocaleString()}
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
