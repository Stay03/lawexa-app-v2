'use client';

import { Download, Trash2, Image as ImageIcon, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserFile } from '@/types/file';

/**
 * Format bytes to a human-readable size string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Get the appropriate icon for a file based on its mime type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType === 'application/pdf') return FileText;
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/rtf'
  ) return FileText;
  return File;
}

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

/**
 * Get file extension from mime type
 */
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP',
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/rtf': 'RTF',
  };
  return map[mimeType] || 'FILE';
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
  const extension = getExtension(file.mime_type);

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
