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
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminAiTool, AdminAiToolsParams } from '@/types/admin-ai';

type ToolSortField = 'name' | 'display_name' | 'category' | 'created_at';

interface AiToolsTableProps {
  tools: AdminAiTool[];
  isLoading: boolean;
  params: AdminAiToolsParams;
  onSort: (sortBy: ToolSortField) => void;
  onEdit: (tool: AdminAiTool) => void;
  onDelete: (tool: AdminAiTool) => void;
}

function getHttpMethodBadge(method: string) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    POST: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Badge variant="outline" className={cn('font-mono text-xs', colors[method] || '')}>
      {method}
    </Badge>
  );
}

export function AiToolsTable({
  tools,
  isLoading,
  params,
  onSort,
  onEdit,
  onDelete,
}: AiToolsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: number) => {
    router.push(`/admin/ai/tools/${id}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: ToolSortField;
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
          <Skeleton className="h-5 w-full max-w-[800px]" />
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

  if (tools.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No tools found
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[150px] font-semibold">
              <SortButton field="display_name">Display Name</SortButton>
            </TableHead>
            <TableHead className="w-[130px] font-semibold">
              <SortButton field="name">Name</SortButton>
            </TableHead>
            <TableHead className="w-[100px] font-semibold">
              <SortButton field="category">Category</SortButton>
            </TableHead>
            <TableHead className="w-[80px] font-semibold">Method</TableHead>
            <TableHead className="w-[160px] font-semibold">Endpoint</TableHead>
            <TableHead className="w-[70px] font-semibold">Timeout</TableHead>
            <TableHead className="w-[50px] font-semibold">Auth</TableHead>
            <TableHead className="w-[80px] font-semibold">Status</TableHead>
            <TableHead className="w-[60px] text-right font-semibold">Agents</TableHead>
            <TableHead className="w-[120px] font-semibold">
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((tool, index) => (
            <TableRow
              key={tool.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
              onClick={() => handleRowClick(tool.id)}
            >
              {/* Display Name */}
              <TableCell className="font-medium max-w-[150px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate">{tool.display_name}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{tool.display_name}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Name (snake_case) */}
              <TableCell className="max-w-[130px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate font-mono text-xs text-muted-foreground cursor-help">
                      {tool.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-mono text-xs">{tool.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Category */}
              <TableCell>
                {tool.category ? (
                  <Badge variant="outline">{tool.category}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>

              {/* HTTP Method */}
              <TableCell>{getHttpMethodBadge(tool.http_method)}</TableCell>

              {/* Endpoint */}
              <TableCell className="max-w-[160px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate font-mono text-xs text-muted-foreground cursor-help">
                      {tool.endpoint_url}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-mono text-xs">{tool.endpoint_url}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Timeout */}
              <TableCell>
                <span className="text-sm tabular-nums">{tool.timeout_seconds}s</span>
              </TableCell>

              {/* Auth */}
              <TableCell>
                {tool.requires_auth ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge variant={tool.is_active ? 'default' : 'secondary'}>
                  {tool.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>

              {/* Agents Count */}
              <TableCell className="text-right tabular-nums">
                {tool.agents_count ?? 0}
              </TableCell>

              {/* Created */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(tool.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(tool.created_at), 'PPpp')}</p>
                  </TooltipContent>
                </Tooltip>
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
                        onEdit(tool);
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
                        onDelete(tool);
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
