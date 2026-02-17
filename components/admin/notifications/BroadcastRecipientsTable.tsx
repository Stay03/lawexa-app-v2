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
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BroadcastRecipient } from '@/types/notification';

/******************************************************************************
                                Types
******************************************************************************/

interface BroadcastRecipientsTableProps {
  recipients: BroadcastRecipient[];
  isLoading: boolean;
}

/******************************************************************************
                                Component
******************************************************************************/

export function BroadcastRecipientsTable({
  recipients,
  isLoading,
}: BroadcastRecipientsTableProps) {
  const router = useRouter();

  const handleUserClick = (e: React.MouseEvent, userUuid: string) => {
    e.stopPropagation();
    router.push(`/admin/users/${userUuid}`);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[400px]" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-4 border-t">
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No recipients found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipients.map((recipient, index) => (
            <TableRow
              key={recipient.notification_id}
              className={cn(index % 2 === 1 && 'bg-muted/30')}
            >
              <TableCell>
                <button
                  className="font-medium text-primary hover:underline text-left"
                  onClick={(e) => handleUserClick(e, recipient.user.uuid)}
                >
                  {recipient.user.name}
                </button>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {recipient.user.email}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {recipient.user.role}
                </Badge>
              </TableCell>
              <TableCell>
                {recipient.read_at ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="default"
                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                      >
                        Read
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatDistanceToNow(new Date(recipient.read_at), {
                        addSuffix: true,
                      })}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-muted-foreground"
                  >
                    Unread
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      {formatDistanceToNow(new Date(recipient.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {new Date(recipient.created_at).toLocaleString()}
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
