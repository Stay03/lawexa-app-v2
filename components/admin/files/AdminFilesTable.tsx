'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Download,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { AdminFileListItem, AdminFileListParams, AdminFileSortBy } from '@/types/admin-files';

interface AdminFilesTableProps {
  files: AdminFileListItem[];
  isLoading: boolean;
  params: AdminFileListParams;
  onSort: (sortBy: AdminFileSortBy) => void;
  onView: (file: AdminFileListItem) => void;
  onDownload: (file: AdminFileListItem) => void;
  onDelete: (file: AdminFileListItem) => void;
}

const STATUS_STYLES: Record<string, string> = {
  completed:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900/50',
  pending:
    'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-900/50',
  processing:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50',
  failed:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50',
};

function SortableHead({
  children,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: AdminFileSortBy;
  currentSort?: string;
  currentOrder?: string;
  onSort: (sortBy: AdminFileSortBy) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <TableHead>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {children}
        <ArrowUpDown
          className={cn(
            'h-3.5 w-3.5',
            isActive ? 'text-foreground' : 'text-muted-foreground/50'
          )}
        />
        {isActive && (
          <span className="text-xs text-muted-foreground">
            {currentOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </TableHead>
  );
}

export function AdminFilesTable({
  files,
  isLoading,
  params,
  onSort,
  onView,
  onDownload,
  onDelete,
}: AdminFilesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!files.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No files found matching your filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead
              sortKey="original_name"
              currentSort={params.sort_by}
              currentOrder={params.sort_order}
              onSort={onSort}
            >
              File Name
            </SortableHead>
            <SortableHead
              sortKey="size"
              currentSort={params.sort_by}
              currentOrder={params.sort_order}
              onSort={onSort}
            >
              Size
            </SortableHead>
            <TableHead>Category</TableHead>
            <TableHead>MIME Type</TableHead>
            <TableHead>Disk</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploader</TableHead>
            <SortableHead
              sortKey="created_at"
              currentSort={params.sort_by}
              currentOrder={params.sort_order}
              onSort={onSort}
            >
              Date
            </SortableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.id}
              className="cursor-pointer"
              onClick={() => onView(file)}
            >
              <TableCell
                className="font-medium max-w-[200px] truncate"
                title={file.original_name}
              >
                {file.original_name}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {file.category}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-[120px] truncate">
                {file.mime_type}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {file.disk}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs capitalize',
                    STATUS_STYLES[file.upload_status] || ''
                  )}
                >
                  {file.upload_status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[120px] truncate">
                {file.uploader?.name || 'N/A'}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {new Date(file.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(file);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(file);
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file);
                      }}
                      className="text-destructive focus:text-destructive"
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
