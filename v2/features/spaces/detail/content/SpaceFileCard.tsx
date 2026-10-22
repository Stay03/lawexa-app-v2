'use client';

import { useMemo, type ReactNode } from 'react';
import { ExternalLink, Eye, Loader2, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SpaceFile } from '@/types/collab';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { FileMark } from '@/v2/features/channels/files/FileMark';
import { playableKind } from '@/v2/features/channels/files/file-model';
import { MediaPlayer } from '@/v2/features/files/MediaPlayer';
import { viewKind, type ViewKind } from '@/v2/features/files/viewable';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { fileTypeLabel } from '../../content-model';
import { SpaceFileMenu, type SpaceFileActions } from './SpaceFileMenu';
import { useCardBreakpoint } from './use-card-breakpoint';

/**
 * SpaceFileCard — what tapping a file in a space's list opens (Stay, 18
 * October 2026, 12:50 UTC, option a). No row in the list has a "…": a chat's
 * actions are in its page's ⋮, a folder's in the folder page's, and a file,
 * which has no page, gets this card instead. Its mark (a picture's thumbnail,
 * else its type's glyph, as in a channel's files), name, type, size and
 * uploader, one "Open file", and the same ⋮ at the top right as every page.
 *
 * TWO FRAMES FOR ONE CARD (Stay, 19:46 UTC, option 1). On a phone it is the
 * bottom sheet. From `md` up the sheet was a white band across the whole window
 * over a dimmed, blurred app ("horrible on web"), so there it is a small card
 * under the tapped row: 22rem, no overlay, the list still readable. It flips
 * above the row when the room under it, short of the space's floating message
 * box (`bottomClearance`), is too small (the popover's own collision
 * handling), and the ⋮'s menu keeps 16px off the window's edges.
 * Esc or a click outside closes it. Only one frame is in the tree at a time
 * (`useCardBreakpoint`).
 *
 * ONE CARD PER LIST, never per row: the feed holds which file is shown, and
 * keeps it while the card closes so the exit plays over the same text.
 *
 * AN ACTION CLOSES THE CARD FIRST. Move, Remove and Delete open their own
 * dialog, and a dialog over a card over the list is two layers for one
 * question; the card is done once the reader picked what to do.
 *
 * A FILE THAT SHOWS HERE GETS "VIEW" OR "PLAY" FIRST (Stay, 21 October 2026:
 * "images should open a gallery, videos should open gallery with 'play'"). A
 * picture's View opens the space's picture viewer over the list, swiping
 * through the list's pictures; a video's or a recording's Play opens the
 * player dialog. Both close the card first, like an action, and the viewer or
 * player is the feed's (`FileViewers`), reached through `onView`. "Open file"
 * stays under them, as the plain open; for any other file it is the one button.
 *
 * THE OPEN STAYS IN THE TAP (`useOpenFileInNewTab`): the empty tab opens
 * synchronously and the fresh URL follows, so an iPhone home-screen app lets
 * it through. Its refusals read here, under the button: a file that no longer
 * exists says so and offers no button; a refused open offers "Try again".
 */
export function SpaceFileCard({
  file,
  anchor,
  bottomClearance,
  open,
  onOpenChange,
  actions,
  onView,
}: {
  /** The file shown; kept while the card closes. */
  file: SpaceFile | null;
  /** The row that was tapped: the small card hangs from it on a computer. */
  anchor: HTMLElement | null;
  /** Px the small card keeps clear above the window's bottom (the space's message box). */
  bottomClearance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What this reader may do to it (the feed's own rules). */
  actions: SpaceFileActions;
  /** Open the file in the feed's viewer or player (View / Play). */
  onView: (file: SpaceFile, kind: ViewKind) => void;
}) {
  const wide = useCardBreakpoint();
  // The popover measures the row through this; a new row is a new anchor.
  const anchorRef = useMemo(() => (anchor ? { current: anchor } : null), [anchor]);
  const shown = open && file !== null;
  const body = file ? (
    <CardBody
      key={file.id}
      file={file}
      actions={actions}
      onView={onView}
      close={() => onOpenChange(false)}
      frame={wide ? 'popover' : 'sheet'}
    />
  ) : null;

  if (wide && anchorRef) {
    return (
      <Popover open={shown} onOpenChange={onOpenChange}>
        <PopoverAnchor virtualRef={anchorRef} />
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={{ top: 16, right: 16, bottom: bottomClearance, left: 16 }}
          aria-label={file ? `File: ${file.original_name}` : undefined}
          className="w-[22rem] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl p-0"
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={shown} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="v2-safe-bottom max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl p-0"
      >
        {body}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The card's contents, the same in both frames. The sheet is a dialog, so its
 * name and facts are the dialog's title and description; the popover is not,
 * so the same words are a plain heading and line there.
 */
function CardBody({
  file,
  actions,
  onView,
  close,
  frame,
}: {
  file: SpaceFile;
  actions: SpaceFileActions;
  onView: (file: SpaceFile, kind: ViewKind) => void;
  close: () => void;
  frame: 'sheet' | 'popover';
}) {
  const { open, opening, failed, gone } = useOpenFileInNewTab();
  const type = fileTypeLabel(file);
  // View for a picture, Play for a video or a recording, nothing for the rest.
  const kind = viewKind(file);
  // Close first, then act: the action's own dialog opens over the list.
  const then = (act?: (file: SpaceFile) => void) =>
    act
      ? (target: SpaceFile) => {
          close();
          act(target);
        }
      : undefined;

  const titleClass = 'line-clamp-2 text-left text-base font-semibold break-words text-foreground';
  const factsClass = 'flex min-w-0 gap-1 text-left text-xs text-muted-foreground';
  const facts: ReactNode = (
    <>
      <span className="shrink-0">
        {type} · {formatBytes(file.size)} ·
      </span>
      <span className="min-w-0 truncate">{file.uploader.name}</span>
    </>
  );
  const heading = (
    <div className="flex items-center gap-3">
      <FileMark file={file} />
      <div className="min-w-0 flex-1">
        {frame === 'sheet' ? (
          <>
            <SheetTitle className={titleClass}>{file.original_name}</SheetTitle>
            <SheetDescription className={factsClass}>{facts}</SheetDescription>
          </>
        ) : (
          <>
            <h2 className={titleClass}>{file.original_name}</h2>
            <p className={factsClass}>{facts}</p>
          </>
        )}
      </div>
      <SpaceFileMenu
        file={file}
        onMoveToFolder={then(actions.onMoveToFolder)}
        onMove={then(actions.onMove)}
        onRemoveFromSpace={then(actions.onRemoveFromSpace)}
        onCopyToMine={then(actions.onCopyToMine)}
        onDelete={then(actions.onDelete)}
      />
    </div>
  );

  return (
    <div
      className={cn(
        'flex w-full flex-col',
        frame === 'sheet' ? 'mx-auto max-w-lg gap-5 px-5 pt-5 pb-6' : 'gap-4 p-4',
      )}
    >
      {frame === 'sheet' ? <SheetHeader className="p-0">{heading}</SheetHeader> : heading}

      {gone ? (
        <p role="status" className="text-sm text-muted-foreground">
          This file is no longer available.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <SpaceMediaPlayer file={file} />
          {kind ? (
            <Button
              type="button"
              size="lg"
              onClick={() => {
                // Close first, then open: the viewer or player opens over the
                // list, not over the card.
                close();
                onView(file, kind);
              }}
              className="w-full"
            >
              {kind === 'picture' ? <Eye aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
              {kind === 'picture' ? 'View' : 'Play'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            variant={kind ? 'outline' : 'default'}
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

/**
 * A video or audio file plays in its card, as it does in a channel's message
 * (Stay, 20 October 2026: "Yes all files"). The player and its link are the
 * shared `MediaPlayer` (`files/MediaPlayer.tsx`, 21 October 2026), so the
 * dialog that Play opens reads the link this card already minted. A player
 * that will not play here says so, and "Open file" below still works. Any
 * other file draws nothing here.
 */
function SpaceMediaPlayer({ file }: { file: SpaceFile }) {
  const kind = playableKind(file);
  if (kind === null) return null;
  return (
    <MediaPlayer
      file={file}
      kind={kind}
      failure={
        <p role="status" className="text-xs text-muted-foreground">
          This {kind === 'audio' ? 'recording' : 'video'} didn&rsquo;t play here. Open it below.
        </p>
      }
    />
  );
}
