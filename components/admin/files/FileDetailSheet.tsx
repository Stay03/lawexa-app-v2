'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import { useAdminFileDetail, useAdminDownloadFile } from '@/lib/hooks/useAdminFiles';

interface FileDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: number | null;
  onDelete: (id: number, name: string) => void;
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">
        {children}
      </span>
    </div>
  );
}

export function FileDetailSheet({
  open,
  onOpenChange,
  fileId,
  onDelete,
}: FileDetailSheetProps) {
  const { data, isLoading } = useAdminFileDetail(fileId);
  const downloadFile = useAdminDownloadFile();

  const file = data?.data;

  function handleDownload() {
    if (file) downloadFile.mutate(file.id);
  }

  function handleDelete() {
    if (file) {
      onOpenChange(false);
      onDelete(file.id, file.original_name);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>File Details</SheetTitle>
          <SheetDescription>
            {isLoading ? (
              <Skeleton className="h-4 w-[200px]" />
            ) : (
              file?.original_name || 'File information'
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            ))}
          </div>
        ) : file ? (
          <div className="mt-6 space-y-1">
            <DetailRow label="ID">{file.id}</DetailRow>
            <DetailRow label="File Name">{file.original_name}</DetailRow>
            <DetailRow label="Internal Name">{file.filename}</DetailRow>
            <DetailRow label="Path">{file.path}</DetailRow>
            <DetailRow label="Size">{formatBytes(file.size)}</DetailRow>
            <DetailRow label="MIME Type">{file.mime_type}</DetailRow>
            <DetailRow label="Category">
              <Badge variant="secondary">{file.category}</Badge>
            </DetailRow>
            <DetailRow label="Disk">
              <Badge variant="outline">{file.disk}</Badge>
            </DetailRow>
            <DetailRow label="Status">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs capitalize',
                  STATUS_STYLES[file.upload_status] || ''
                )}
              >
                {file.upload_status}
              </Badge>
            </DetailRow>
            <DetailRow label="Hash">
              <span className="font-mono text-xs">{file.hash}</span>
            </DetailRow>

            <Separator className="my-3" />

            <DetailRow label="Uploader">{file.uploader?.name || 'N/A'}</DetailRow>
            <DetailRow label="Uploader Email">{file.uploader?.email || 'N/A'}</DetailRow>

            {file.fileable_type && (
              <>
                <Separator className="my-3" />
                <DetailRow label="Fileable Type">{file.fileable_type}</DetailRow>
                <DetailRow label="Fileable ID">{file.fileable_id ?? 'N/A'}</DetailRow>
              </>
            )}

            {file.metadata && Object.keys(file.metadata).length > 0 && (
              <>
                <Separator className="my-3" />
                <p className="text-sm font-medium mb-2">Metadata</p>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  {JSON.stringify(file.metadata, null, 2)}
                </pre>
              </>
            )}

            <Separator className="my-3" />

            <DetailRow label="Created">
              {new Date(file.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </DetailRow>
            <DetailRow label="Updated">
              {new Date(file.updated_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </DetailRow>

            <div className="flex gap-3 pt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDownload}
                disabled={downloadFile.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground mt-6">
            File not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
