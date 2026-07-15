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
import { formatDistanceToNow, format } from 'date-fns';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import {
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Bookmark,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { CaseSummary, AdminCasesParams } from '@/types/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CasesTableProps {
  cases: CaseSummary[];
  isLoading: boolean;
  params: AdminCasesParams;
  onSort: (sortBy: 'title' | 'judgment_date' | 'created_at') => void;
  onEdit: (caseData: CaseSummary) => void;
  onDelete: (caseData: CaseSummary) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Table component for cases list
 * Shows case title, court, judgment date, citation, stats, and actions
 */
export function CasesTable({
  cases,
  isLoading,
  params,
  onSort,
  onEdit,
  onDelete,
}: CasesTableProps) {
  const router = useRouter();

  const handleRowClick = (slug: string) => {
    router.push(`/admin/cases/${slug}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: 'title' | 'judgment_date' | 'created_at';
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

  // Loading State with fading skeleton
  if (isLoading) {
    // Opacity values: first items fully visible, progressively fading out
    const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];

    return (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[300px] font-semibold">
                <SortButton field="title">Case Title</SortButton>
              </TableHead>
              <TableHead className="w-[150px] font-semibold">Court</TableHead>
              <TableHead className="w-[130px] font-semibold">
                <SortButton field="judgment_date">Judgment Date</SortButton>
              </TableHead>
              <TableHead className="w-[200px] font-semibold">Citation</TableHead>
              <TableHead className="w-[100px] text-center font-semibold">
                Stats
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
                  {/* Case Title */}
                  <TableCell className="max-w-[300px]">
                    <Skeleton className="h-4 w-full animate-pulse rounded" />
                  </TableCell>
                  {/* Court */}
                  <TableCell>
                    <Skeleton className="h-5 w-16 animate-pulse rounded" />
                  </TableCell>
                  {/* Judgment Date */}
                  <TableCell>
                    <Skeleton className="h-4 w-24 animate-pulse rounded" />
                  </TableCell>
                  {/* Citation */}
                  <TableCell className="max-w-[200px]">
                    <Skeleton className="h-4 w-32 animate-pulse rounded" />
                  </TableCell>
                  {/* Stats */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-3">
                      <Skeleton className="h-4 w-8 animate-pulse rounded" />
                      <Skeleton className="h-4 w-8 animate-pulse rounded" />
                    </div>
                  </TableCell>
                  {/* Actions */}
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
  if (cases.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No cases found
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[300px] font-semibold">
              <SortButton field="title">Case Title</SortButton>
            </TableHead>
            <TableHead className="w-[150px] font-semibold">Court</TableHead>
            <TableHead className="w-[130px] font-semibold">
              <SortButton field="judgment_date">Judgment Date</SortButton>
            </TableHead>
            <TableHead className="w-[200px] font-semibold">Citation</TableHead>
            <TableHead className="w-[100px] text-center font-semibold">
              Stats
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseData, index) => (
            <TableRow
              key={caseData.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
              onClick={() => handleRowClick(caseData.slug)}
            >
              {/* Case Title */}
              <TableCell className="font-medium max-w-[300px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/admin/cases/${caseData.slug}`}
                      className="block truncate hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getCaseDisplayTitle(caseData)}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[400px]">
                    <p>{getCaseDisplayTitle(caseData)}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Court */}
              <TableCell>
                {caseData.court ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {typeof caseData.court === 'string' ? caseData.court : caseData.court.abbreviation}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>

              {/* Judgment Date */}
              <TableCell>
                {caseData.judgment_date ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm cursor-help">
                        {format(new Date(caseData.judgment_date), 'MMM d, yyyy')}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>
                        {formatDistanceToNow(new Date(caseData.judgment_date), {
                          addSuffix: true,
                        })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>

              {/* Citation */}
              <TableCell className="max-w-[200px]">
                {caseData.citation ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate font-mono text-xs text-muted-foreground cursor-help">
                        {caseData.citation}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-mono text-xs">{caseData.citation}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>

              {/* Stats (Views & Bookmarks) */}
              <TableCell>
                <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="tabular-nums">{caseData.views_count}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Views</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <Bookmark className="h-3.5 w-3.5" />
                        <span className="tabular-nums">
                          {caseData.bookmarks_count}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Bookmarks</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
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
                        router.push(`/admin/cases/${caseData.slug}`);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(caseData);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(caseData);
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
