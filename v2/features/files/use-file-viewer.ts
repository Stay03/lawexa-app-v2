'use client';

import { useCallback, useState } from 'react';

import { usePdfViewer, type PdfViewer } from './pdf/use-pdf-viewer';
import { pictureTarget, type ViewKind } from './viewable';

/**
 * use-file-viewer — what a file list holds for its viewer: which file is open.
 * One per list, never per row, so a hundred rows share one viewer, and the
 * row's callback is stable (the rows are memo'd). `FileViewers.tsx` draws it.
 *
 * A picture, a video and a recording all open the SAME viewer, at their place
 * in the list's set (Stay, 22 October 2026: "There should be consistency").
 * A PDF opens in the PDF reader's dialog instead (`pdf`; the techlead, 24
 * October 2026: "every PDF in the app opens in the reader"), from the same
 * `view` call, so a row does not need to know which.
 */
export interface FileViewer {
  /**
   * Open this file here, in the viewer. `returnFocusTo` names where focus goes
   * back when it closes, for a press whose control closes with its own frame
   * (a space file card's View or Play): the row the card hung from. Left out,
   * it is the pressed control.
   */
  view: (file: ViewedFile, returnFocusTo?: HTMLElement | null) => void;
  /** The open file, as the viewer spells it (`pictureTarget`); `null` when
   *  closed. */
  picture: string | null;
  /** Move to a sibling, or close with `null`. */
  setPicture: (target: string | null) => void;
  /** Where focus goes back when the viewer closes (`view`). */
  returnTo: HTMLElement | null;
  /** The open PDF, drawn by `FileViewers` as the reader's dialog. */
  pdf: PdfViewer;
}

/** What `view` is told about a file. A PDF's type and size are for its
 *  dialog's Download and facts; a payload without a type gives a PDF's. */
export interface ViewedFile {
  id: number;
  name: string;
  kind: ViewKind;
  mimeType?: string | null;
  size?: number | null;
}

export function useFileViewer(): FileViewer {
  const [picture, setPicture] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<HTMLElement | null>(null);
  const pdf = usePdfViewer();
  const openPdf = pdf.open;

  // Stable, so each row's `memo` holds. The setters are listed for the React
  // Compiler's lint, which does not assume a setter is stable.
  const view = useCallback(
    (file: ViewedFile, returnFocusTo?: HTMLElement | null) => {
      if (file.kind === 'pdf') {
        openPdf(
          { id: file.id, name: file.name, mimeType: file.mimeType || 'application/pdf', size: file.size },
          returnFocusTo,
        );
        return;
      }
      // Read at the press (an event, not a render): the control under it,
      // unless the host named the element that outlives it.
      const pressed = returnFocusTo ?? document.activeElement;
      setReturnTo(pressed instanceof HTMLElement ? pressed : null);
      setPicture(pictureTarget(file.id));
    },
    [setPicture, setReturnTo, openPdf],
  );

  return { view, picture, setPicture, returnTo, pdf };
}
