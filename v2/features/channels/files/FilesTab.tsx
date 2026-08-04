'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  Presentation,
  Trash2,
  Upload,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import { formatBytes } from '@/lib/utils/format-bytes';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Channel, ChannelFile } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import {
  useDeleteChannelFile,
  useDownloadChannelFile,
  useUploadChannelFile,
} from '../lists-files-mutations';
import {
  canManageChannel,
  FILE_ACCEPT_ATTR,
  isArchiveFile,
  validateChannelFile,
} from '../model';
import { channelsQueries } from '../queries';
import { RelativeTime } from '../ui/RelativeTime';

/**
 * FilesTab — the channel's document library: upload (button or drag-drop)
 * with the CURRENT allow-list (incl. `zip` — the Jul-25→Aug-3 surface),
 * pending-row optimism, type icons, the two-zone meta line, download, and
 * uploader/governance delete. A v2 port of v1's FilesPanel/FileRow (study
 * A6 KEEP + the zip FIX). Phase-5 W2; sources: LF §4 via api-digest §C/§F.10
 * — 2026-08-04.
 *
 * ZIP RULE (backend obligation, §F.10): archives are download-only and are
 * NOT malware-scanned — every zip row carries the "open only what you trust"
 * note, and nothing anywhere says Lawexa can read them (it can't — no
 * extracted text).
 *
 * Rejections surface INLINE in a dismissible strip above the list (client
 * pre-validation names the file + reason; a server 422 lands in the same
 * strip) — no toasts from this screen. Realtime `.file.changed` keeps the
 * library live through the N3 writers.
 */
export function FilesTab({
  channel,
  viewerId,
}: {
  channel: Channel;
  viewerId: number | null;
}) {
  const filesQuery = useQuery(
    channelsQueries.files({ channelUuid: channel.uuid, viewerId }),
  );
  const uploadFile = useUploadChannelFile(channel.uuid);
  // Files are the uuid-only rule's exception (§F.4): the uploader check needs
  // the INTEGER id, which only the sanctioned bridge carries.
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ id: number; name: string }[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const pendingId = useRef(0);

  const files = filesQuery.data?.data ?? [];
  const uploadMutate = uploadFile.mutate;

  const handleFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    const rejections: string[] = [];

    for (const file of incoming) {
      const validationError = validateChannelFile(file);
      if (validationError) {
        rejections.push(validationError);
        continue;
      }
      const uploadId = (pendingId.current += 1);
      setPending((prev) => [...prev, { id: uploadId, name: file.name }]);
      uploadMutate(file, {
        onError: (error) => {
          setUploadErrors((prev) => [
            ...prev,
            `"${file.name}" — ${extractApiError(error).message}`,
          ]);
        },
        onSettled: () => {
          setPending((prev) => prev.filter((item) => item.id !== uploadId));
        },
      });
    }
    if (rejections.length > 0) {
      setUploadErrors((prev) => [...prev, ...rejections]);
    }
  };

  const openFilePicker = () => inputRef.current?.click();

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    // Scroll lives on the inner wrapper so the drop overlay always covers the
    // VISIBLE panel box even when the list is scrolled (v1's exact reason).
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTR}
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            handleFiles(event.target.files);
          }
          event.target.value = '';
        }}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between gap-3 pb-3">
            <h2 className="text-base font-semibold">Files</h2>
            <Button size="sm" onClick={openFilePicker}>
              <Upload aria-hidden className="size-4" />
              Upload
            </Button>
          </div>

          {uploadErrors.length > 0 && (
            <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <ul className="min-w-0 flex-1 space-y-0.5 text-xs text-destructive">
                  {uploadErrors.map((message, index) => (
                    <li key={index} className="break-words">
                      {message}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setUploadErrors([])}
                  className="shrink-0 rounded text-xs font-medium text-destructive underline underline-offset-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {filesQuery.isPending ? (
            <FilesSkeleton />
          ) : filesQuery.isError ? (
            <CollabMessage
              icon={Paperclip}
              tone="alert"
              title="Couldn't load files"
              description="Something went wrong on our side. Please try again."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void filesQuery.refetch()}
                >
                  Try again
                </Button>
              }
            />
          ) : files.length === 0 && pending.length === 0 ? (
            <CollabMessage
              icon={Paperclip}
              tone="neutral"
              title="No files yet"
              description="Share documents with everyone in this channel — drag them here or upload."
              action={
                <Button size="sm" onClick={openFilePicker}>
                  <Upload aria-hidden className="size-4" />
                  Upload a file
                </Button>
              }
            />
          ) : (
            <div className="space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
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
          )}
        </div>
      </div>

      {/* Drop overlay — symmetric fade, pointer-transparent. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-xs',
          'transition-opacity duration-200 motion-reduce:transition-none',
          isDragging ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-card px-8 py-6 text-center shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
            <Upload aria-hidden className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Drop files to upload</p>
        </div>
      </div>
    </div>
  );
}

/* ── Rows ─────────────────────────────────────────────────────────────────── */

/** A transient dashed row for an in-flight upload. */
function PendingFileRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/60 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-muted-foreground">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Uploading…</p>
      </div>
    </div>
  );
}

type FileIconKind =
  | 'image'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'document'
  | 'generic';

/** Classify by mime (the server validates content, so mime wins) with the
 *  extension as fallback for generic mimes. */
function fileIconKind(mimeType: string, name: string): FileIconKind {
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
  if (isArchiveFile(mimeType, name)) return 'archive';
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

/** Concrete element per bucket (no component-reference-picked-in-render). */
function FileTypeIcon({
  mimeType,
  name,
  className,
}: {
  mimeType: string;
  name: string;
  className?: string;
}) {
  switch (fileIconKind(mimeType, name)) {
    case 'image':
      return <ImageIcon aria-hidden className={className} />;
    case 'spreadsheet':
      return <FileSpreadsheet aria-hidden className={className} />;
    case 'presentation':
      return <Presentation aria-hidden className={className} />;
    case 'archive':
      return <FileArchive aria-hidden className={className} />;
    case 'document':
      return <FileText aria-hidden className={className} />;
    default:
      return <FileIcon aria-hidden className={className} />;
  }
}

/** One library row: type icon, name, the two-zone meta line (size · uploader
 *  left, age right), the zip caution, and hover/touch-visible actions. */
function FileRow({
  file,
  channel,
  currentUserId,
}: {
  file: ChannelFile;
  channel: Channel;
  currentUserId: number | null;
}) {
  const download = useDownloadChannelFile();
  const deleteFile = useDeleteChannelFile(channel.uuid);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isArchive = isArchiveFile(file.mime_type, file.original_name);
  const canDelete =
    (currentUserId !== null && file.uploader.id === currentUserId) ||
    canManageChannel(channel);

  return (
    <div className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors duration-150 hover:bg-accent/40 motion-reduce:transition-none">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileTypeIcon
          mimeType={file.mime_type}
          name={file.original_name}
          className="size-4 text-muted-foreground"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.original_name}>
          {file.original_name}
        </p>
        {/* Two-zone meta: facts left, time right-anchored (exact on hover). */}
        <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {formatBytes(file.size)} · {file.uploader.name}
          </span>
          <RelativeTime iso={file.created_at} className="shrink-0" />
        </div>
        {isArchive && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Archives aren&rsquo;t scanned — only open files from people you trust.
          </p>
        )}
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center gap-1 opacity-0',
          'transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none',
          '[@media(hover:none)]:opacity-100',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => download.mutate(file.id)}
          disabled={download.isPending}
          aria-label={`Download ${file.original_name}`}
          title="Download"
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          {download.isPending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Download aria-hidden className="size-4" />
          )}
        </Button>

        {canDelete && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setConfirmOpen(true)}
              disabled={deleteFile.isPending}
              aria-label={`Delete ${file.original_name}`}
              title="Delete"
              className="size-8 text-muted-foreground hover:text-destructive"
            >
              {deleteFile.isPending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden className="size-4" />
              )}
            </Button>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete “{file.original_name}”?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the file from the channel for everyone. This
                    can&rsquo;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteFile.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteFile.mutate(file.id);
                      setConfirmOpen(false);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
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

function FilesSkeleton() {
  return (
    <div aria-hidden className="space-y-2">
      {[60, 45, 52].map((nameWidth, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border bg-card p-3"
          style={{ opacity: Math.max(0.35, 1 - index * 0.25) }}
        >
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 rounded" style={{ width: `${nameWidth}%` }} />
            <Skeleton className="h-3 w-32 max-w-[60%] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
