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
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTestAiProvider } from '@/lib/hooks/useAdminAi';
import type {
  AdminAiProvider,
  AdminAiProvidersParams,
} from '@/types/admin-ai';

interface AiProvidersTableProps {
  providers: AdminAiProvider[];
  isLoading: boolean;
  params: AdminAiProvidersParams;
  onSort: (sortBy: 'name' | 'created_at') => void;
  onEdit: (provider: AdminAiProvider) => void;
  onDelete: (provider: AdminAiProvider) => void;
}

export function AiProvidersTable({
  providers,
  isLoading,
  params,
  onSort,
  onEdit,
  onDelete,
}: AiProvidersTableProps) {
  const router = useRouter();
  const testMutation = useTestAiProvider();

  const handleRowClick = (id: number) => {
    router.push(`/admin/ai/providers/${id}`);
  };

  const handleTest = (e: React.MouseEvent, provider: AdminAiProvider) => {
    e.stopPropagation();
    testMutation.mutate(provider.id, {
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success(
            `Connection successful (${response.data.response_time_ms}ms)`
          );
        } else {
          toast.error(response.data.error || 'Connection failed');
        }
      },
      onError: () => {
        toast.error('Something went wrong');
      },
    });
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: 'name' | 'created_at';
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

  if (providers.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No providers found
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[200px] font-semibold">
              <SortButton field="name">Name</SortButton>
            </TableHead>
            <TableHead className="w-[150px] font-semibold">Slug</TableHead>
            <TableHead className="w-[250px] font-semibold">Base URL</TableHead>
            <TableHead className="w-[100px] font-semibold">Status</TableHead>
            <TableHead className="w-[80px] text-right font-semibold">
              Models
            </TableHead>
            <TableHead className="w-[140px] font-semibold">
              <SortButton field="created_at">Created</SortButton>
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((provider, index) => (
            <TableRow
              key={provider.id}
              className={cn(
                'cursor-pointer transition-colors',
                index % 2 === 1 && 'bg-muted/20'
              )}
              onClick={() => handleRowClick(provider.id)}
            >
              <TableCell className="font-medium max-w-[200px]">
                <span className="block truncate">{provider.name}</span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs text-muted-foreground">
                  {provider.slug}
                </span>
              </TableCell>
              <TableCell className="max-w-[250px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate font-mono text-xs text-muted-foreground cursor-help">
                      {provider.base_url}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-mono text-xs">{provider.base_url}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Badge
                  variant={provider.is_active ? 'default' : 'secondary'}
                >
                  {provider.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {provider.models_count}
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(provider.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(provider.created_at), 'PPpp')}</p>
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
                        onEdit(provider);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleTest(e, provider)}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Test API Key
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(provider);
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
