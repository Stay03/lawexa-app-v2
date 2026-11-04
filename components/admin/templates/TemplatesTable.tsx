'use client';

import Link from 'next/link';
import { Download, Loader2, MoreHorizontal, PencilLine, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AdminTemplateRow, AdminTemplateStatus } from '@/types/admin-templates';
import { blanksLabel, STATUS_LABELS } from './template-model';

/** The admin pages' status colours (AdminFilesTable), in light and dark. */
const STATUS_STYLES: Record<AdminTemplateStatus, string> = {
  live: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900/50',
  draft: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-900/50',
  processing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50',
  failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50',
};

export function TemplateStatusBadge({ status }: { status: AdminTemplateStatus }) {
  return (
    <Badge variant="outline" className={cn('gap-1 whitespace-nowrap', STATUS_STYLES[status])}>
      {status === 'processing' ? <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" /> : null}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function whenLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The templates, newest first: name and source file, the labels, status
 * (with the reason when reading failed), blanks, and who uploaded it when.
 * The name opens the review screen.
 */
export function TemplatesTable({
  rows,
  isLoading,
  filtered,
  onDownload,
  onDelete,
}: {
  rows: readonly AdminTemplateRow[];
  isLoading: boolean;
  /** A filter or a search is on: the empty line says so. */
  filtered: boolean;
  onDownload: (row: AdminTemplateRow) => void;
  onDelete: (row: AdminTemplateRow) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        {filtered ? 'No template matches these filters.' : 'No templates yet. Upload Word, RTF or PDF files to start.'}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Practice area</TableHead>
            <TableHead>Document type</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Blanks</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.uuid}>
              <TableCell className="max-w-[280px]">
                <Link href={`/admin/templates/${row.uuid}`} className="block truncate font-medium hover:underline">
                  {row.name || row.source.original_name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {row.source.original_name} · {formatBytes(row.source.size)}
                </p>
              </TableCell>
              <TableCell>{row.practice_area ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell>{row.document_type ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell>{row.country?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="max-w-[200px]">
                <TemplateStatusBadge status={row.status} />
                {row.status === 'failed' && row.error ? (
                  <p className="mt-1 line-clamp-2 whitespace-normal text-xs text-red-700 dark:text-red-400">{row.error}</p>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {row.status === 'processing' ? '—' : blanksLabel(row.blanks_count)}
              </TableCell>
              <TableCell className="max-w-[150px]">
                <p className="truncate text-sm">{row.uploaded_by?.name ?? '—'}</p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">{whenLabel(row.created_at)}</p>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${row.name || row.source.original_name}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/templates/${row.uuid}`}>
                        <PencilLine className="mr-2 size-4" />
                        {row.status === 'live' ? 'Edit' : 'Review'}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDownload(row)}>
                      <Download className="mr-2 size-4" />
                      Download original
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(row)}>
                      <Trash2 className="mr-2 size-4" />
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
