'use client';

import { useState } from 'react';
import {
  Download,
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  Presentation,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDeleteChannelFile } from '@/lib/hooks/useCollab';
import { useDownloadFile } from '@/lib/hooks/useFiles';
import { extractApiError } from '@/lib/utils/api-error';
import { formatBytes } from '@/lib/utils/format-bytes';
import { formatRelativeTime } from '@/lib/utils/collab';
import type { Channel, ChannelFile } from '@/types/collab';

/** The coarse file-type buckets we render a distinct icon for. */
type FileIconKind =
  | 'image'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'document'
  | 'generic';

/**
 * Classify a file by mime type (falling back to its extension) into an icon
 * bucket. Mime wins because the server validates by content type; the extension
 * is a fallback when the mime is generic (e.g. `application/octet-stream`).
 */
export function fileIcon(mimeType: string, name: string): FileIconKind {
  const mime = mimeType.toLowerCase();
  const ext = name.toLowerCase().split('.').pop() ?? '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    ['csv', 'xlsx', 'xls'].includes(ext)
  ) {
    return 'spreadsheet';
  }
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['pptx', 'ppt'].includes(ext)
  ) {
    return 'presentation';
  }
  if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    ext === 'zip'
  ) {
    return 'archive';
  }
  if (
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime === 'application/rtf' ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)
  ) {
    return 'document';
  }
  return 'generic';
}

/**
 * Render the type icon for a file. Each bucket renders a concrete icon element
 * (no component reference chosen at render time) to satisfy React-Compiler lint.
 */
function FileTypeIcon({
  mimeType,
  name,
  className,
}: {
  mimeType: string;
  name: string;
  className?: string;
}) {
  switch (fileIcon(mimeType, name)) {
    case 'image':
      return <ImageIcon className={className} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={className} />;
    case 'presentation':
      return <Presentation className={className} />;
    case 'archive':
      return <FileArchive className={className} />;
    case 'document':
      return <FileText className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}

interface FileRowProps {
  file: ChannelFile;
  channel: Channel;
  /** The signed-in user's integer id (files are id-addressed), or null. */
  currentUserId: number | null;
}

/**
 * A single file in the channel library: a type icon, the name + a muted meta
 * line (size · uploader · age), and hover/focus-revealed Download and (for the
 * uploader or channel governance) Delete actions.
 */
export function FileRow({ file, channel, currentUserId }: FileRowProps) {
  // Own download/delete state so each row spins independently.
  const download = useDownloadFile();
  const deleteFile = useDeleteChannelFile(channel.uuid);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Archives are served as-is — no server-side malware scan yet.
  const isArchive = fileIcon(file.mime_type, file.original_name) === 'archive';

  const canDelete =
    file.uploader.id === currentUserId ||
    channel.my_role === 'owner' ||
    channel.my_role === 'admin';

  const handleDownload = () => {
    download.mutate(file.id);
  };

  const handleDelete = () => {
    deleteFile.mutate(file.id, {
      onSuccess: () => {
        toast.success('File deleted.');
      },
      onError: (error) => {
        toast.error('Could not delete file', {
          description: extractApiError(error).message,
        });
      },
    });
    setConfirmOpen(false);
  };

  return (
    <div className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-border hover:bg-accent/40">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileTypeIcon
          mimeType={file.mime_type}
          name={file.original_name}
          className="h-4 w-4 text-muted-foreground"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.original_name}>
          {file.original_name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatBytes(file.size)} · {file.uploader.name} ·{' '}
          {formatRelativeTime(file.created_at)}
        </p>
        {isArchive && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Archives aren&apos;t scanned — only open files from people you
            trust.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleDownload}
              disabled={download.isPending}
              aria-label={`Download ${file.original_name}`}
              className="text-muted-foreground hover:text-foreground"
            >
              {download.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download</TooltipContent>
        </Tooltip>

        {canDelete && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={deleteFile.isPending}
                  aria-label={`Delete ${file.original_name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {deleteFile.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete “{file.original_name}”?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the file from the channel for everyone. This
                    can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteFile.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      handleDelete();
                    }}
                    disabled={deleteFile.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteFile.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
