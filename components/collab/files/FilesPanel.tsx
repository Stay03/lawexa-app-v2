'use client';

import { useRef, useState, type DragEvent } from 'react';
import { Loader2, Paperclip, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useChannelFiles, useUploadChannelFile } from '@/lib/hooks/useCollab';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel } from '@/types/collab';

import { FileRow } from './FileRow';

interface FilesPanelProps {
  channel: Channel;
  className?: string;
}

/** Allowed upload extensions — mirrors the server contract (§4). */
const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'rtf',
  'csv',
  'xlsx',
  'pptx',
  'zip',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
] as const;

/** 15 MB, matching the server's max upload size. */
const MAX_FILE_SIZE = 15 * 1024 * 1024;

/** `accept` attribute value for the file input (leading-dot extensions). */
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/**
 * Validate a file against the allowed extensions + max size. Returns an error
 * string (naming the file + reason) when rejected, or `null` when valid. The
 * server stays authoritative — a 422 still surfaces as a toast on upload.
 */
function validateFile(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${file.name}" isn't a supported file type.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" is larger than 15 MB.`;
  }
  return null;
}

/** A file mid-upload, tracked in local state and shown as a pending row. */
interface PendingUpload {
  id: number;
  name: string;
}

/** Row placeholders while the channel's files load — mirrors FileRow. */
function FilesPanelSkeleton() {
  return (
    <div className="space-y-2">
      {[60, 45, 52, 38].map((nameWidth, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border bg-card p-3"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4" style={{ width: `${nameWidth}%` }} />
            <Skeleton className="h-3 w-32 max-w-[60%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A transient row for a file that's currently uploading. */
function PendingFileRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/60 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-muted-foreground">
          {name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Uploading…</p>
      </div>
    </div>
  );
}

/**
 * The Files tab: the channel's document library. Any member can upload (via the
 * top-bar button or by dropping onto the panel); files can be downloaded and,
 * for the uploader or channel governance, deleted. Realtime keeps the list live
 * for other members' uploads and deletes.
 */
export function FilesPanel({ channel, className }: FilesPanelProps) {
  const { data, isLoading, isError, refetch } = useChannelFiles(channel.uuid);
  const uploadFile = useUploadChannelFile(channel.uuid);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  // A ref counter distinguishes the drop-zone leaving from crossing a child
  // boundary (dragenter fires on children too), so the overlay doesn't flicker.
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const pendingId = useRef(0);

  const files = data?.data ?? [];

  /** Validate a batch, toast each rejection, and upload the valid files. */
  const handleFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    for (const file of incoming) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        continue;
      }

      const uploadId = (pendingId.current += 1);
      setPending((prev) => [...prev, { id: uploadId, name: file.name }]);

      uploadFile
        .mutateAsync(file)
        .then(() => {
          toast.success(`Uploaded "${file.name}".`);
        })
        .catch((uploadError: unknown) => {
          toast.error(`Couldn't upload "${file.name}"`, {
            description: extractApiError(uploadError).message,
          });
        })
        .finally(() => {
          setPending((prev) => prev.filter((item) => item.id !== uploadId));
        });
    }
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (selected && selected.length > 0) {
      handleFiles(selected);
    }
    // Reset so selecting the same file again re-triggers change.
    event.target.value = '';
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    // Prevent the browser from opening the dropped file in the tab.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const renderBody = () => {
    if (isLoading) {
      return <FilesPanelSkeleton />;
    }
    if (isError) {
      return (
        <ErrorState
          title="Couldn't load files"
          description="We couldn't load this channel's files. Please try again."
          retry={() => refetch()}
        />
      );
    }
    if (files.length === 0 && pending.length === 0) {
      return (
        <EmptyState
          icon={Paperclip}
          title="No files yet"
          description="Share documents with everyone in this channel — drag them here or upload."
          action={{ label: 'Upload a file', onClick: openFilePicker }}
        />
      );
    }
    return (
      <div className="space-y-2">
        {pending.map((item) => (
          <PendingFileRow key={item.id} name={item.name} />
        ))}
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            channel={channel}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    );
  };

  return (
    // The scroll lives on the inner wrapper so the drop overlay (absolute
    // inset-0 on this non-scrolling root) always covers the VISIBLE panel box,
    // even when the file list is scrolled down.
    <div
      className={cn('relative flex flex-col overflow-hidden', className)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <h2 className="text-base font-semibold">Files</h2>
            <Button size="sm" onClick={openFilePicker}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 py-4">{renderBody()}</div>
      </div>

      {isDragging && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-xs"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-card px-8 py-6 text-center shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Drop files to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}
