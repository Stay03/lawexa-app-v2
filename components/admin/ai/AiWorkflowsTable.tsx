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
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminAiWorkflow, AdminAiWorkflowsParams } from '@/types/admin-ai';

type WorkflowSortField = 'name' | 'created_at' | 'is_default';

interface AiWorkflowsTableProps {
  workflows: AdminAiWorkflow[];
  isLoading: boolean;
  params: AdminAiWorkflowsParams;
  onSort: (sortBy: WorkflowSortField) => void;
  onEdit: (workflow: AdminAiWorkflow) => void;
  onDelete: (workflow: AdminAiWorkflow) => void;
}

export function AiWorkflowsTable({
  workflows,
  isLoading,
  params,
  onSort,
  onEdit,
  onDelete,
}: AiWorkflowsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: number) => {
    router.push(`/admin/ai/workflows/${id}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: WorkflowSortField;
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

  if (workflows.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No workflows found
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[160px] font-semibold">
              <SortButton field="name">Name</SortButton>
            </TableHead>
            <TableHead className="w-[120px] font-semibold">Slug</TableHead>
            <TableHead className="w-[110px] font-semibold">Execution Mode</TableHead>
            <TableHead className="w-[80px] font-semibold">
              <SortButton field="is_default">Default</SortButton>
            </TableHead>
            <TableHead className="w-[80px] font-semibold">Status</TableHead>
            <TableHead className="w-[80px] text-right font-semibold">Agents</TableHead>
            <TableHead className="w-[90px] text-right font-semibold">Conversations</TableHead>
            <TableHead className="w-[120px] font-semibold">
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((workflow, index) => (
            <TableRow
              key={workflow.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
              onClick={() => handleRowClick(workflow.id)}
            >
              {/* Name */}
              <TableCell className="font-medium max-w-[160px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate">{workflow.name}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{workflow.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Slug */}
              <TableCell className="max-w-[120px]">
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {workflow.slug}
                </span>
              </TableCell>

              {/* Execution Mode */}
              <TableCell>
                <Badge variant={workflow.execution_mode === 'react' ? 'default' : 'outline'}>
                  {workflow.execution_mode}
                </Badge>
              </TableCell>

              {/* Default */}
              <TableCell>
                <Star
                  className={cn(
                    'h-4 w-4',
                    workflow.is_default
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground'
                  )}
                />
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                  {workflow.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>

              {/* Agents Count */}
              <TableCell className="text-right">
                {workflow.agents && workflow.agents.length > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="tabular-nums cursor-help">
                        {workflow.agents.length}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="space-y-0.5 text-xs">
                        {workflow.agents.map((agent) => (
                          <p key={agent.id}>
                            {agent.name}{' '}
                            <span className="text-muted-foreground">({agent.role})</span>
                          </p>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="tabular-nums text-muted-foreground">0</span>
                )}
              </TableCell>

              {/* Conversations */}
              <TableCell className="text-right tabular-nums">
                {workflow.conversations_count ?? 0}
              </TableCell>

              {/* Created */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(workflow.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(workflow.created_at), 'PPpp')}</p>
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
                        onEdit(workflow);
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
                        onDelete(workflow);
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
