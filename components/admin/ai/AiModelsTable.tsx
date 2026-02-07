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
import type { AdminAiModel, AdminAiModelsParams } from '@/types/admin-ai';

type ModelSortField = 'name' | 'input_price_per_1m' | 'output_price_per_1m' | 'max_context_tokens' | 'created_at';

interface AiModelsTableProps {
  models: AdminAiModel[];
  isLoading: boolean;
  params: AdminAiModelsParams;
  onSort: (sortBy: ModelSortField) => void;
  onEdit: (model: AdminAiModel) => void;
  onDelete: (model: AdminAiModel) => void;
}

function formatContextTokens(tokens: number | null | undefined): string {
  if (!tokens) return '-';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K`;
  return tokens.toLocaleString();
}

export function AiModelsTable({
  models,
  isLoading,
  params,
  onSort,
  onEdit,
  onDelete,
}: AiModelsTableProps) {
  const router = useRouter();

  const handleRowClick = (id: number) => {
    router.push(`/admin/ai/models/${id}`);
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: ModelSortField;
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

  if (models.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No models found
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
            <TableHead className="w-[160px] font-semibold">Model ID</TableHead>
            <TableHead className="w-[120px] font-semibold">Provider</TableHead>
            <TableHead className="w-[110px] text-right font-semibold">
              <SortButton field="input_price_per_1m">Input $/1M</SortButton>
            </TableHead>
            <TableHead className="w-[110px] text-right font-semibold">
              <SortButton field="output_price_per_1m">Output $/1M</SortButton>
            </TableHead>
            <TableHead className="w-[100px] text-right font-semibold">
              <SortButton field="max_context_tokens">Context</SortButton>
            </TableHead>
            <TableHead className="w-[70px] text-center font-semibold">Vision</TableHead>
            <TableHead className="w-[80px] text-center font-semibold">Stream</TableHead>
            <TableHead className="w-[120px] font-semibold">
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model, index) => (
            <TableRow
              key={model.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
              onClick={() => handleRowClick(model.id)}
            >
              <TableCell className="font-medium max-w-[160px]">
                <span className="block truncate">{model.name}</span>
              </TableCell>
              <TableCell className="max-w-[160px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate font-mono text-xs text-muted-foreground cursor-help">
                      {model.model_id}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-mono text-xs">{model.model_id}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                {model.provider ? (
                  <button
                    className="text-sm text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin/ai/providers/${model.provider!.id}`);
                    }}
                  >
                    {model.provider.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                ${model.input_price_per_1m}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                ${model.output_price_per_1m}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatContextTokens(model.max_context_tokens)}
              </TableCell>
              <TableCell className="text-center">
                {model.supports_vision ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                )}
              </TableCell>
              <TableCell className="text-center">
                {model.supports_streaming ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                )}
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(model.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(model.created_at), 'PPpp')}</p>
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
                        onEdit(model);
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
                        onDelete(model);
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
