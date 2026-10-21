'use client';

import { ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useShowFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { MediaPlayer } from './MediaPlayer';
import type { PlayableFile } from './viewable';

/**
 * MediaPlayerDialog — a video or a recording in a folder or a space plays
 * here, over the list (Stay, 21 October 2026: "videos should open gallery
 * with 'play'"). A sheet on a phone, a card on a computer (`ResponsiveOverlay`,
 * sized to the player), named by the file; the browser's own controls carry
 * Play, and nothing plays until it is pressed.
 *
 * STAYS MOUNTED WHILE CLOSED, holding its last file, so Radix plays the exit
 * over the same title rather than over nothing (`ResponsiveOverlay`'s own
 * rule). The host keeps `{ file, open }` for that reason, as the space file
 * card does; a new file is a new body, so one file's failure never shows on
 * the next.
 *
 * FOCUS GOES BACK TO WHERE THE PLAY CAME FROM (`returnFocusTo`): the row's
 * button, or the row a space file card hung from, since the card's Play
 * closes the card as it opens this and is gone by the close. Without it Radix
 * has no trigger to return to and focus lands on `<body>`.
 *
 * WHEN IT WILL NOT PLAY HERE (a link expired twice over, a codec this engine
 * lacks), it says so and offers the open the row had before this dialog: a
 * new tab, through the same tap-first opener (`useShowFileInNewTab`), with
 * that opener's own refusals under the button.
 */
export function MediaPlayerDialog({
  file,
  open,
  onOpenChange,
  returnFocusTo = null,
}: {
  /** The file shown; kept while the dialog closes. */
  file: PlayableFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes back when the dialog closes (the docblock). */
  returnFocusTo?: HTMLElement | null;
}) {
  return (
    <ResponsiveOverlay
      open={open && file !== null}
      onOpenChange={onOpenChange}
      title={file?.name ?? ''}
      size="content"
      // A video wants the width; a recording is one strip of controls.
      className={file?.kind === 'video' ? 'md:max-w-3xl' : undefined}
      returnFocusTo={returnFocusTo}
    >
      {file ? <PlayerBody key={file.id} file={file} /> : null}
    </ResponsiveOverlay>
  );
}

function PlayerBody({ file }: { file: PlayableFile }) {
  const openInTab = useShowFileInNewTab();
  const noun = file.kind === 'audio' ? 'recording' : 'video';
  return (
    <MediaPlayer
      file={{ id: file.id, original_name: file.name }}
      kind={file.kind}
      failure={
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-lg bg-muted px-4 py-6 text-center"
        >
          <p className="text-sm text-muted-foreground">This {noun} didn&rsquo;t play here.</p>
          {openInTab.gone ? (
            <p className="text-xs text-muted-foreground">This file is no longer available.</p>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => openInTab.open(file.id)}
              disabled={openInTab.opening}
              className="disabled:cursor-progress"
            >
              {openInTab.opening ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <ExternalLink aria-hidden className="size-4" />
              )}
              Open in a new tab
            </Button>
          )}
          {openInTab.failed && !openInTab.gone ? (
            <p className="text-xs text-muted-foreground">Couldn&rsquo;t open it. Try again.</p>
          ) : null}
        </div>
      }
    />
  );
}
