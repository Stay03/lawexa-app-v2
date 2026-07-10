'use client';

import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/validations/admin-cases';
import {
  ObservabilityTable,
  UserCell,
  TimeAgoCell,
  ErrorCell,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import type { FileExtraction } from '@/types/admin-file-extractions';

const COLUMNS: ObservabilityColumn[] = [
  { key: 'file', label: 'File' },
  { key: 'user', label: 'Uploader', className: 'w-[200px]' },
  { key: 'attached', label: 'Attached to', className: 'w-[150px]' },
  { key: 'detail', label: 'Detail', className: 'w-[260px]' },
  { key: 'created', label: 'Uploaded', className: 'w-[140px]' },
];

function shortFileable(type: string | null, id: number | null): string {
  if (!type) return '—';
  const model = type.split('\\').pop() ?? type;
  return id != null ? `${model} #${id}` : model;
}

function DetailCell({ file }: { file: FileExtraction }) {
  if (file.extraction_status === 'done') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {file.extraction_method && (
          <Badge variant="secondary" className="font-mono">
            {file.extraction_method}
          </Badge>
        )}
        {file.char_count != null && <span>{file.char_count.toLocaleString()} chars</span>}
        {file.page_count != null && <span>· {file.page_count} pages</span>}
      </div>
    );
  }
  if (file.extraction_status === 'empty') {
    return (
      <span className="text-sm text-amber-600 dark:text-amber-400">
        {file.extraction_error ?? 'Extraction ran, no text found'}
      </span>
    );
  }
  if (file.extraction_status === 'failed') {
    return <ErrorCell error={file.extraction_error} />;
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

interface FileExtractionsTableProps {
  files: FileExtraction[];
  isLoading: boolean;
}

export function FileExtractionsTable({ files, isLoading }: FileExtractionsTableProps) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={files.length === 0}
      emptyText="No files in this state"
    >
      {files.map((file, index) => (
        <TableRow key={file.id} className={cn(index % 2 === 1 && 'bg-muted/20')}>
          <TableCell className="max-w-[280px]">
            <p className="truncate text-sm font-medium">{file.original_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {file.mime_type ?? 'unknown'} · {formatFileSize(file.size)}
            </p>
          </TableCell>
          <TableCell>
            <UserCell user={file.uploader} />
          </TableCell>
          <TableCell>
            <span className="text-sm text-muted-foreground">
              {shortFileable(file.fileable_type, file.fileable_id)}
            </span>
          </TableCell>
          <TableCell className="max-w-[260px]">
            <DetailCell file={file} />
          </TableCell>
          <TableCell>
            <TimeAgoCell value={file.created_at} />
          </TableCell>
        </TableRow>
      ))}
    </ObservabilityTable>
  );
}
