'use client';

import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatFileSize, getFileExtension, getFileIcon } from '@/lib/utils/file-display';
import type { UserFile } from '@/types/file';

/**
 * Format a date string to a short display format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface FileCardProps {
  file: UserFile;
  onDelete: (file: UserFile) => void;
  onDownload: (file: UserFile) => void;
  index: number;
  className?: string;
  style?: React.CSSProperties;
}

export function FileCard({ file, onDelete, onDownload, index, className, style }: FileCardProps) {
  const isImage = file.category === 'content-image';
  const Icon = getFileIcon(file.mime_type);
  const extension = getFileExtension(file.mime_type);

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both',
        className
      )}
      style={{
        animationDelay: `${Math.min(index, 14) * 30}ms`,
        ...style,
      }}
    >
      {/* Preview area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {isImage && file.url ? (
          <img
            src={file.url}
            alt={file.original_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <div className="rounded-xl bg-background/80 p-3 shadow-sm">
              <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <Badge variant="secondary" className="text-[10px] font-semibold">
              {extension}
            </Badge>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 shadow-md"
            onClick={() => onDownload(file)}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8 shadow-md"
            onClick={() => onDelete(file)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* File info */}
      <div className="flex flex-col gap-0.5 p-3">
        <p className="truncate text-sm font-medium" title={file.original_name}>
          {file.original_name}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatFileSize(file.size)}</span>
          <span>{formatDate(file.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
