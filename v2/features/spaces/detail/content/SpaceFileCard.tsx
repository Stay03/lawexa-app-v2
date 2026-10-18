'use client';

import { ExternalLink, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SpaceFile } from '@/types/collab';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { FileMark } from '@/v2/features/channels/files/FileMark';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { fileTypeLabel } from '../../content-model';
import { SpaceFileMenu, type SpaceFileActions } from './SpaceFileMenu';

/**
 * SpaceFileCard — what tapping a file in a space's list opens (Stay, 18
 * October 2026, 12:50 UTC, option a). No row in the list has a "…": a chat's
 * actions are in its page's ⋮, a folder's in the folder page's, and a file,
 * which has no page, gets this card instead. Its mark (a picture's thumbnail,
 * else its type's glyph, as in a channel's files), name, type, size and
 * uploader, one "Open file", and the same ⋮ at the top right as every page.
 *
 * ONE CARD PER LIST, never per row: the feed holds which file is shown, and
 * keeps it while the card closes so the exit plays over the same text.
 *
 * AN ACTION CLOSES THE CARD FIRST. Move, Remove and Delete open their own
 * dialog, and a dialog over a sheet over the list is two layers of dimming for
 * one question; the card is done once the reader picked what to do.
 *
 * THE OPEN STAYS IN THE TAP (`useOpenFileInNewTab`): the empty tab opens
 * synchronously and the fresh URL follows, so an iPhone home-screen app lets
 * it through. Its refusals read here, under the button: a file that no longer
 * exists says so and offers no button; a refused open offers "Try again".
 */
export function SpaceFileCard({
  file,
  open,
  onOpenChange,
  actions,
}: {
  /** The file shown; kept while the card closes. */
  file: SpaceFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What this reader may do to it (the feed's own rules). */
  actions: SpaceFileActions;
}) {
  return (
    <Sheet open={open && file !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="v2-safe-bottom max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl p-0"
      >
        {file ? <CardBody key={file.id} file={file} actions={actions} close={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

/** Keyed by the file, so a new file starts with a fresh opener (no stale "Couldn't open it"). */
function CardBody({ file, actions, close }: { file: SpaceFile; actions: SpaceFileActions; close: () => void }) {
  const { open, opening, failed, gone } = useOpenFileInNewTab();
  const type = fileTypeLabel(file);
  // Close first, then act: the action's own dialog opens over the list.
  const then = (act?: (file: SpaceFile) => void) =>
    act
      ? (target: SpaceFile) => {
          close();
          act(target);
        }
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 pt-5 pb-6">
      <SheetHeader className="p-0">
        <div className="flex items-center gap-3">
          <FileMark file={file} />
          <div className="min-w-0 flex-1">
            <SheetTitle className="line-clamp-2 text-left text-base break-words">{file.original_name}</SheetTitle>
            <SheetDescription className="flex min-w-0 gap-1 text-left text-xs">
              <span className="shrink-0">
                {type} · {formatBytes(file.size)} ·
              </span>
              <span className="min-w-0 truncate">{file.uploader.name}</span>
            </SheetDescription>
          </div>
          <SpaceFileMenu
            file={file}
            onMove={then(actions.onMove)}
            onRemoveFromSpace={then(actions.onRemoveFromSpace)}
            onCopyToMine={then(actions.onCopyToMine)}
            onDelete={then(actions.onDelete)}
          />
        </div>
      </SheetHeader>

      {gone ? (
        <p role="status" className="text-sm text-muted-foreground">
          This file is no longer available.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            onClick={() => open(file.id)}
            disabled={opening}
            className="w-full disabled:cursor-progress"
          >
            {opening ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ExternalLink aria-hidden className="size-4" />}
            Open file
          </Button>
          {failed ? (
            <p role="status" className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Couldn&rsquo;t open it.</span>
              <button
                type="button"
                onClick={() => open(file.id)}
                className={cn('rounded font-medium text-foreground underline underline-offset-2', FOCUS_RING)}
              >
                Try again
              </button>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
