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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format } from 'date-fns';
import {
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LawyerVerificationStatusBadge } from './LawyerVerificationStatusBadge';
import type { AdminLawyerVerificationListItem } from '@/types/admin-lawyer-verification';

/******************************************************************************
                                Component Props
******************************************************************************/

interface LawyerVerificationsTableProps {
  items: AdminLawyerVerificationListItem[];
  isLoading: boolean;
  onApprove: (item: AdminLawyerVerificationListItem) => void;
  onReject: (item: AdminLawyerVerificationListItem) => void;
}

/******************************************************************************
                                Helper
******************************************************************************/

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Check if item is in a pending state (submitted, not yet decided) */
function isPending(item: AdminLawyerVerificationListItem): boolean {
  return !item.is_verified && !!item.verification_submitted_at && !item.verifier;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Table component for the lawyer verifications list.
 * Shows user info, document count, status, submitted date, and actions.
 */
export function LawyerVerificationsTable({
  items,
  isLoading,
  onApprove,
  onReject,
}: LawyerVerificationsTableProps) {
  const router = useRouter();

  const columns = (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableHead className="w-[220px] font-semibold">Lawyer</TableHead>
      <TableHead className="w-[100px] font-semibold">Documents</TableHead>
      <TableHead className="w-[130px] font-semibold">Status</TableHead>
      <TableHead className="w-[160px] font-semibold">Submitted</TableHead>
      <TableHead className="w-[60px]" />
    </TableRow>
  );

  // Loading state with fading skeleton
  if (isLoading) {
    const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];

    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>{columns}</TableHeader>
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
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full animate-pulse" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28 animate-pulse rounded" />
                        <Skeleton className="h-3 w-36 animate-pulse rounded" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-14 animate-pulse rounded" />
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

  // Empty state
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>{columns}</TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No verification submissions found
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  // Data rows
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>{columns}</TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const pending = isPending(item);

            return (
              <TableRow
                key={item.id}
                className={cn(
                  'cursor-pointer transition-colors',
                  index % 2 === 1 && 'bg-muted/20'
                )}
                onClick={() =>
                  router.push(`/admin/lawyer-verifications/${item.id}`)
                }
              >
                {/* Lawyer */}
                <TableCell className="max-w-[220px]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={item.user.avatar_url ?? undefined}
                        alt={item.user.name}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(item.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Documents count */}
                <TableCell>
                  <Badge variant="secondary" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {item.documents.length}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <LawyerVerificationStatusBadge
                    isVerified={item.is_verified}
                    submittedAt={item.verification_submitted_at}
                  />
                </TableCell>

                {/* Submitted date */}
                <TableCell>
                  {item.verification_submitted_at ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(item.verification_submitted_at),
                            { addSuffix: true }
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {format(
                          new Date(item.verification_submitted_at),
                          'PPpp'
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      &mdash;
                    </span>
                  )}
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
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(
                            `/admin/lawyer-verifications/${item.id}`
                          )
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onApprove(item)}
                        disabled={!pending}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onReject(item)}
                        disabled={!pending}
                        className="text-destructive focus:text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
