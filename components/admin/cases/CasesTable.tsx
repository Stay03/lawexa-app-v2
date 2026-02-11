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

  const handleRowClick = (id: number) => {
    router.push(`/admin/cases/${id}`);
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

  // Loading State
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
              onClick={() => handleRowClick(caseData.id)}
            >
              {/* Case Title */}
              <TableCell className="font-medium max-w-[300px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate">{caseData.title}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[400px]">
                    <p>{caseData.title}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Court */}
              <TableCell>
                {caseData.court ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {caseData.court}
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
                        router.push(`/admin/cases/${caseData.id}`);
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
