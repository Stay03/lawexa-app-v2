'use client';

import { ExternalLink, Loader2, Music } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useShowFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import type { ViewerMedia as ViewerMediaFile } from '@/v2/features/channels/feed/image-target';
import { MediaPlayer } from './MediaPlayer';

/**
 * ViewerMedia — a video or a recording inside the full-screen file viewer,
 * where a picture would sit (Stay, 22 October 2026: the picture viewer and the
 * player "looks like different things one at the middle one at the bottom.
 * There should be consistency"). The viewer's own bar above it names the file
 * and carries Download and Open; this draws only the player.
 *
 * A VIDEO is centred and fitted to the screen like a picture. A RECORDING has
 * no picture to show, so it sits in a centred card with its name over the
 * player. Nothing plays until Play is pressed (`MediaPlayer`), and the viewer
 * mounts only the file on screen, so a swipe away stops it.
 */
export function ViewerMedia({ file }: { file: ViewerMediaFile }) {
  const failure = <PlayFailure fileId={file.id} kind={file.kind} />;
  if (file.kind === 'audio') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-2xl bg-white/10 px-6 py-8 text-white">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-white/10">
          <Music className="size-6" />
        </span>
        <p className="w-full truncate text-center text-sm font-medium">{file.original_name}</p>
        <MediaPlayer file={file} kind="audio" failure={failure} />
      </div>
    );
  }
  return <MediaPlayer file={file} kind="video" failure={failure} className="max-h-[calc(100dvh-9rem)]" />;
}

/** What stands in the player's place when the file will not play here: the
 *  file's own tab, as the file row opens it. */
function PlayFailure({ fileId, kind }: { fileId: number; kind: 'video' | 'audio' }) {
  const openInTab = useShowFileInNewTab();
  const noun = kind === 'audio' ? 'recording' : 'video';
  return (
    <div
      role="status"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-white/10 px-6 py-8 text-center text-white"
    >
      <p className="text-sm text-white/80">This {noun} didn&rsquo;t play here.</p>
      {openInTab.gone ? (
        <p className="text-xs text-white/60">This file is no longer available.</p>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => openInTab.open(fileId)}
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
        <p className="text-xs text-white/60">Couldn&rsquo;t open it. Try again.</p>
      ) : null}
    </div>
  );
}
