'use client';

import { useCallback, useState } from 'react';

import { pictureTarget, type PlayableFile, type ViewKind } from './viewable';

/**
 * use-file-viewer — what a file list holds for its viewers: which picture is
 * open, and which video or recording is in the player. One per list, never per
 * row, so a hundred rows share one picture viewer and one player, and the
 * row's callback is stable (the rows are memo'd). `FileViewers.tsx` draws it.
 */
export interface FileViewer {
  /**
   * Open this file here: a picture in the viewer, media in the player.
   * `returnFocusTo` names where focus goes back when it closes, for a press
   * whose control closes with its own frame (a space file card's View or
   * Play): the row the card hung from. Left out, it is the pressed control.
   */
  view: (file: { id: number; name: string; kind: ViewKind }, returnFocusTo?: HTMLElement | null) => void;
  /** The open picture, as the viewer spells it (`pictureTarget`); `null` when
   *  closed. */
  picture: string | null;
  /** Move to a sibling, or close with `null`. */
  setPicture: (target: string | null) => void;
  /** The player's file, kept while it closes so the exit plays over the same
   *  title (the space file card's rule). */
  media: { file: PlayableFile; open: boolean } | null;
  setMediaOpen: (open: boolean) => void;
  /** Where focus goes back when the open viewer or player closes (`view`). */
  returnTo: HTMLElement | null;
}

export function useFileViewer(): FileViewer {
  const [picture, setPicture] = useState<string | null>(null);
  const [media, setMedia] = useState<FileViewer['media']>(null);
  const [returnTo, setReturnTo] = useState<HTMLElement | null>(null);

  // Stable, so each row's `memo` holds. The setters are listed for the React
  // Compiler's lint, which does not assume a setter is stable.
  const view = useCallback(
    (file: { id: number; name: string; kind: ViewKind }, returnFocusTo?: HTMLElement | null) => {
      // Read at the press (an event, not a render): the control under it,
      // unless the host named the element that outlives it.
      const pressed = returnFocusTo ?? document.activeElement;
      setReturnTo(pressed instanceof HTMLElement ? pressed : null);
      if (file.kind === 'picture') {
        setPicture(pictureTarget(file.id));
        return;
      }
      setMedia({ file: { id: file.id, name: file.name, kind: file.kind }, open: true });
    },
    [setPicture, setMedia, setReturnTo],
  );
  const setMediaOpen = useCallback(
    (open: boolean) => setMedia((previous) => (previous ? { ...previous, open } : previous)),
    [setMedia],
  );

  return { view, picture, setPicture, media, setMediaOpen, returnTo };
}
