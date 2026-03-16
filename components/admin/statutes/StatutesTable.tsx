'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { format } from 'date-fns';
import {
  ArrowUpDown,
  MoreHorizontal,
  Trash2,
  Eye,
  Bookmark,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AdminStatute, AdminStatutesParams } from '@/types/admin-statutes';

/******************************************************************************
                                Component Props
******************************************************************************/

interface StatutesTableProps {
  statutes: AdminStatute[];
  isLoading: boolean;
  params: AdminStatutesParams;
  onSort: (sortBy: string) => void;
  onDelete: (statute: AdminStatute) => void;
}

/******************************************************************************
                                Helpers
******************************************************************************/

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'amended':
      return 'secondary';
    case 'repealed':
      return 'destructive';
    default:
      return 'outline';
  }
}

/******************************************************************************
                                Main Component
******************************************************************************/

export function StatutesTable({
  statutes,
  isLoading,
  params,
  onSort,
  onDelete,
}: StatutesTableProps) {
  const router = useRouter();

  const handleRowClick = (slug: string) => {
    router.push(`/admin/statutes/${slug}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: string;
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

  if (isLoading) {
    const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];

    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[300px] font-semibold">Title</TableHead>
              <TableHead className="w-[120px] font-semibold">Country</TableHead>
              <TableHead className="w-[80px] font-semibold">Year</TableHead>
              <TableHead className="w-[100px] font-semibold">Status</TableHead>
              <TableHead className="w-[100px] font-semibold">Created</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow
                key={i}
                className={cn(i % 2 === 1 && 'bg-muted/20')}
                style={{ opacity: opacityValues[i] ?? 0.25 }}
              >
                <TableCell><Skeleton className="h-4 w-full animate-pulse rounded" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 animate-pulse rounded" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12 animate-pulse rounded" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 animate-pulse rounded" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 animate-pulse rounded" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8 animate-pulse rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (statutes.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No statutes found
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[300px] font-semibold">
              <SortButton field="title">Title</SortButton>
            </TableHead>
            <TableHead className="w-[120px] font-semibold">Country</TableHead>
            <TableHead className="w-[80px] font-semibold">
              <SortButton field="year">Year</SortButton>
            </TableHead>
            <TableHead className="w-[100px] font-semibold">Status</TableHead>
            <TableHead className="w-[80px] text-center font-semibold">Stats</TableHead>
            <TableHead className="w-[100px] font-semibold">
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {statutes.map((statute, index) => (
            <TableRow
              key={statute.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
              onClick={() => handleRowClick(statute.slug)}
            >
              {/* Title */}
              <TableCell className="font-medium max-w-[300px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/admin/statutes/${statute.slug}`}
                      className="block truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {statute.title}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[400px]">
                    <p>{statute.title}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Country */}
              <TableCell>
                {statute.country ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {statute.country.abbreviation || statute.country.name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>

              {/* Year */}
              <TableCell>
                <span className="text-sm tabular-nums">{statute.year}</span>
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge variant={statusVariant(statute.status)}>
                  {statute.status_label}
                </Badge>
              </TableCell>

              {/* Stats */}
              <TableCell>
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <Bookmark className="h-3.5 w-3.5" />
                        <span className="tabular-nums">{statute.bookmarks_count}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Bookmarks</p></TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>

              {/* Created */}
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(statute.created_at), 'MMM d, yyyy')}
                </span>
              </TableCell>

              {/* Actions */}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/statutes/${statute.slug}`);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/statutes-v2/${statute.slug}`, '_blank');
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Rendered
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(statute);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
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
