'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { filesQueries } from './queries';

/**
 * MediaPlayer — a video or a recording, played from a fresh link.
 *
 * The one player behind a space file's card (inline since 20 October 2026,
 * Stay: "Yes all files") and the player dialog a folder's or a space's media
 * opens (21 October 2026). The browser's own controls carry Play, nothing
 * plays until it is pressed, and `preload="metadata"` means a card that opens
 * fetches the first bytes, not the file.
 *
 * THE LINK IS MINTED WHEN THE PLAYER MOUNTS (`filesQueries.downloadUrl`) and
 * shared by every player of the file, so the dialog a card's Play opens reads
 * the link the card already holds. A player that fails asks for one fresh
 * link, since a link can expire while the player is on screen; a link that
 * comes back unchanged cannot play differently, so that, or a second failure,
 * shows the host's `failure`, which says where else the file opens. A play
 * that gets as far as its metadata re-arms the one refresh, so a dialog left
 * open past the hour recovers again.
 *
 * THE PLAYER OWNS ITS `src` ONCE IT HAS ONE. The query is read for the first
 * link only, adopted by React's guarded render-adjust (the `useHeldValue`
 * idiom); after that only the refresh above changes it. The element is keyed
 * by `src`, and the query refetches by itself (a tab brought back after the
 * link's 50 minutes, a reconnect): a player that followed it would be rebuilt
 * on the fresh link and start again from 0:00, mid-play.
 */
export function MediaPlayer({
  file,
  kind,
  failure,
  className,
}: {
  file: { id: number; original_name: string };
  kind: 'video' | 'audio';
  /** What stands in the player's place when it will not play here. */
  failure: ReactNode;
  /** The video's frame, when the host wants more than the card's. */
  className?: string;
}) {
  const link = useQuery(filesQueries.downloadUrl(file.id));
  const [retried, setRetried] = useState(false);
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const minted = link.data?.data?.url ?? null;
  if (src === null && minted !== null) setSrc(minted);

  const onError = () => {
    if (retried) {
      setFailed(true);
      return;
    }
    setRetried(true);
    void link.refetch().then((result) => {
      const fresh = result.data?.data?.url ?? null;
      // The same link again cannot play differently (the picture tile's rule).
      if (fresh === null || fresh === src) {
        setFailed(true);
        return;
      }
      setSrc(fresh);
    });
  };

  if (failed || link.isError) return <>{failure}</>;
  if (src === null) {
    return (
      <div
        aria-hidden
        className={cn(
          'w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none',
          kind === 'audio' ? 'h-12' : 'aspect-video',
          className,
        )}
      />
    );
  }
  return kind === 'audio' ? (
    <audio
      key={src}
      src={src}
      controls
      preload="metadata"
      onLoadedMetadata={() => setRetried(false)}
      onError={onError}
      aria-label={file.original_name}
      className={cn('w-full', className)}
    />
  ) : (
    <video
      key={src}
      src={src}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={() => setRetried(false)}
      onError={onError}
      aria-label={file.original_name}
      className={cn('aspect-video w-full rounded-lg bg-black object-contain', className)}
    />
  );
}
