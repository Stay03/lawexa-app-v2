'use client';

import { useState } from 'react';
import { Download, Loader2, ShieldAlert, Trash2 } from 'lucide-react';

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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { Channel, ChannelFile } from '@/types/collab';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  useDeleteChannelFile,
  useDownloadChannelFile,
} from '../lists-files-mutations';
import { ARCHIVE_NOTE, canManageChannel, isArchiveFile } from '../model';
import { RelativeTime } from '../ui/RelativeTime';
import { FileMark } from './FileMark';

/**
 * FileRow — one file in the channel library, at CHAT'S DENSITY.
 *
 * The tab used to be the only surface in the feature built from bordered
 * cards, sitting inside the same screen as the hairline-row transcript: one
 * screen, two densities, which is the one thing a design system cannot afford.
 * These are hairline rows with a 40px `FileMark` — a real thumbnail when the
 * file is an image — and the two-zone meta line every other collab row speaks.
 *
 * ── THE ARCHIVE CAUTION IS A CHIP, AND IT IS STILL A DISCLOSURE ────────────
 * Archives are download-only and are NOT malware-scanned (backend obligation,
 * digest §F.10), and that has to be said. It used to be said as a permanent
 * third line competing with the filename for the row's attention; it is now a
 * chip whose accessible NAME is the whole sentence, so a screen reader gets
 * the obligation in full, with the sentence also visible in a tooltip.
 *
 * The tooltip is CONTROLLED and opens on click as well as on hover/focus.
 * Radix closes a tooltip on pointer-down, so a hover-only disclosure would be
 * unreadable on every touch device — which is where "only open files from
 * people you trust" matters most.
 */
export function FileRow({
  file,
  channel,
  currentUserId,
}: {
  file: ChannelFile;
  channel: Channel;
  /** Files are the uuid-only rule's exception (§F.4): the uploader check needs
   *  the INTEGER id, which only the sanctioned auth bridge carries. */
  currentUserId: number | null;
}) {
  // Per-row mutations, deliberately: one instance shared by the list would put
  // every row's spinner on at once the moment any row was downloaded.
  const download = useDownloadChannelFile();
  const deleteFile = useDeleteChannelFile(channel.uuid);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const downloading = download.isPending;
  const deleting = deleteFile.isPending;
  const isArchive = isArchiveFile(file.mime_type, file.original_name);
  const canDelete =
    (currentUserId !== null && file.uploader.id === currentUserId) ||
    canManageChannel(channel);

  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none">
      <FileMark file={file} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className="min-w-0 truncate text-sm font-medium text-foreground"
            title={file.original_name}
          >
            {file.original_name}
          </p>
          {isArchive ? <ArchiveChip /> : null}
        </div>

        <MetaLine
          className="mt-0.5"
          lead={[formatBytes(file.size), file.uploader.name]}
          trail={[<RelativeTime key="age" iso={file.created_at} />]}
        />

        {/* The download's one visible failure. It is HERE rather than in a
            toast because this tab raises none, and it needs to exist at all
            because a blocked new tab is a tap that does nothing: the retry is
            a fresh gesture, which is exactly what an engine that refused the
            first one will honour. */}
        {download.isError && (
          <p
            role="status"
            className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"
          >
            <span>Couldn&rsquo;t open it.</span>
            <button
              type="button"
              onClick={() => download.mutate(file.id)}
              className={cn(
                'rounded font-medium text-foreground underline underline-offset-2',
                FOCUS_RING,
              )}
            >
              Try again
            </button>
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
          disabled={downloading}
          aria-label={`Download ${file.original_name}`}
          title="Download"
          className="v2-interactive size-8 text-muted-foreground hover:text-foreground"
        >
          {downloading ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Download aria-hidden className="size-4" />
          )}
        </Button>

        {canDelete ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              aria-label={`Delete ${file.original_name}`}
              title="Delete"
              className="v2-interactive size-8 text-muted-foreground hover:text-destructive"
            >
              {deleting ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden className="size-4" />
              )}
            </Button>

            {/* Destructive confirmation stays OUT of the URL: a shareable,
                refresh-surviving link that re-opens "Delete this file?" is an
                armed trigger. */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{file.original_name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the file from the channel for everyone. This
                    can&rsquo;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
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
        ) : null}
      </div>
    </div>
  );
}

/** The zip caution, one line tall and out of the filename's way. The sentence
 *  itself lives in `../model` beside the predicate — the feed owes the same
 *  disclosure on an attached zip and must not keep a second copy of it. */
function ArchiveChip() {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          // The whole sentence IS the accessible name — the obligation is not
          // allowed to live only in a hover surface.
          aria-label={ARCHIVE_NOTE}
          onClick={() => setOpen(true)}
          className={cn(
            'v2-interactive inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5',
            'text-[11px] font-medium text-muted-foreground transition-colors duration-150',
            'hover:text-foreground motion-reduce:transition-none',
            FOCUS_RING,
          )}
        >
          <ShieldAlert aria-hidden className="size-3" />
          Not scanned
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{ARCHIVE_NOTE}</TooltipContent>
    </Tooltip>
  );
}
