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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminAiAgent, AdminAiAgentsParams } from '@/types/admin-ai';

type AgentSortField = 'name' | 'created_at' | 'temperature';

interface AiAgentsTableProps {
  agents: AdminAiAgent[];
  isLoading: boolean;
  params: AdminAiAgentsParams;
  onSort: (sortBy: AgentSortField) => void;
  onDelete: (agent: AdminAiAgent) => void;
}

export function AiAgentsTable({
  agents,
  isLoading,
  params,
  onSort,
  onDelete,
}: AiAgentsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: number) => {
    router.push(`/admin/ai/agents/${id}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: AgentSortField;
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

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No agents found
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
            <TableHead className="w-[130px] font-semibold">Slug</TableHead>
            <TableHead className="w-[140px] font-semibold">Model</TableHead>
            <TableHead className="w-[100px] text-right font-semibold">
              <SortButton field="temperature">Temp</SortButton>
            </TableHead>
            <TableHead className="w-[100px] text-right font-semibold">Max Tokens</TableHead>
            <TableHead className="w-[80px] font-semibold">Status</TableHead>
            <TableHead className="w-[100px] text-right font-semibold">Conversations</TableHead>
            <TableHead className="w-[120px] font-semibold">
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent, index) => (
            <TableRow
              key={agent.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
              onClick={() => handleRowClick(agent.id)}
            >
              <TableCell className="font-medium max-w-[160px]">
                <span className="block truncate">{agent.name}</span>
              </TableCell>
              <TableCell className="max-w-[130px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate font-mono text-xs text-muted-foreground cursor-help">
                      {agent.slug}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-mono text-xs">{agent.slug}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                {agent.model ? (
                  <button
                    className="text-sm text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin/ai/models/${agent.model!.id}`);
                    }}
                  >
                    {agent.model.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {agent.temperature}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {agent.max_response_tokens.toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                  {agent.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {agent.conversations_count ?? 0}
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(agent.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(agent.created_at), 'PPpp')}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
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
                        router.push(`/admin/ai/agents/${agent.id}/edit`);
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
                        onDelete(agent);
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
