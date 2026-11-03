'use client';

import { useCallback, useState } from 'react';

import type { PdfPassage } from './pdf-passages';

/**
 * use-pdf-viewer — which PDF a screen has open in the reader dialog
 * (`PdfViewerDialog`), held in state.
 *
 * IN STATE, NOT IN THE ADDRESS, like the file lists' picture viewer
 * (`use-file-viewer.ts`). Back still closes it: the dialog adds one history
 * step while open (`PdfViewerDialog`). Escape, the close button and a tap on
 * the scrim close it too.
 */
export interface PdfTarget {
  id: number;
  name: string;
  /** The stored type, for Download's file name and type. */
  mimeType: string;
  /** Bytes, for the dialog's facts; 0 or absent when the payload had none. */
  size?: number | null;
  /** Where to open and what to mark, in order (a Radar report's affected
   *  file): the reader opens on the first, and the bar steps through them. */
  passages?: readonly PdfPassage[];
  /** Which of `passages` to open on (the one a link was for); the first when left out. */
  startPassage?: number;
}

export interface PdfViewer {
  /** The open PDF, or `null` when closed. */
  file: PdfTarget | null;
  /** Open this PDF. `returnFocusTo` names where focus goes back on close, for
   *  a press whose control closes with its own frame (a space file card). */
  open: (file: PdfTarget, returnFocusTo?: HTMLElement | null) => void;
  close: () => void;
  /** Where focus goes back when the dialog closes. */
  returnTo: HTMLElement | null;
}

/** What the reader's dialog draws from (`PdfViewerDialog`): the open PDF, and how it closes. */
export type ShownPdf = Pick<PdfViewer, 'file' | 'close' | 'returnTo'>;

export function usePdfViewer(): PdfViewer {
  const [file, setFile] = useState<PdfTarget | null>(null);
  const [returnTo, setReturnTo] = useState<HTMLElement | null>(null);

  const open = useCallback(
    (next: PdfTarget, returnFocusTo?: HTMLElement | null) => {
      // Read at the press (an event, not a render).
      const pressed = returnFocusTo ?? document.activeElement;
      setReturnTo(pressed instanceof HTMLElement ? pressed : null);
      setFile(next);
    },
    [setFile, setReturnTo],
  );
  const close = useCallback(() => setFile(null), [setFile]);

  return { file, open, close, returnTo };
}
