'use client';

import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDownloadFile } from '@/lib/hooks/useFiles';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { MessageAttachment } from '@/types/collab';

import { FileTypeIcon } from './files/FileRow';

/**
 * The files a message carries, read-only (backend, 2026-08-05).
 *
 * WHY THIS EXISTS IN v1 AT ALL. v1 has no attach affordance and is not getting
 * one — but v1 is still the live UI for most people, and a message posted from
 * v2 with a file and no caption would render here as an empty bubble. This is
 * the smallest thing that stops that: name the files, let them be opened, and
 * nothing else.
 *
 * IT SPEAKS v1's LANGUAGE, NOT v2's. Bordered cards, a type glyph, the muted
 * meta line, `formatBytes` — the same row the Files panel next door already
 * uses, one size down. No thumbnails: v1 shows a glyph for an image everywhere
 * else it shows a file, and inventing a picture surface here would make the
 * conversation and its own Files panel disagree about what a file looks like.
 *
 * OPENING GOES THROUGH `useDownloadFile`, which asks `/files/{id}/download`
 * for a signed URL at click time. `attachment.url` is deliberately never used:
 * it expires an hour after the message arrived, so a link built from it works
 * until it silently doesn't. v1's error channel is a toast, and that hook
 * already raises one.
 */
export function MessageAttachmentList({
  attachments,
}: {
  attachments: readonly MessageAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <AttachmentCard attachment={attachment} />
        </li>
      ))}
    </ul>
  );
}

function AttachmentCard({ attachment }: { attachment: MessageAttachment }) {
  // Per-card, so one download's spinner is not every card's spinner.
  const download = useDownloadFile();

  return (
    <div className="flex max-w-sm items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileTypeIcon
          mimeType={attachment.mime_type}
          name={attachment.original_name}
          className="h-4 w-4 text-muted-foreground"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={attachment.original_name}>
          {attachment.original_name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatBytes(attachment.size)}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => download.mutate(attachment.id)}
        disabled={download.isPending}
        aria-label={`Download ${attachment.original_name}`}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        {download.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
