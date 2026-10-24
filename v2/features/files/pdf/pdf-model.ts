/**
 * pdf-model — the PDF reader's decisions, pure: no pdf.js, no React, so they
 * can be read and tested on their own (the in-app PDF reader, the file list
 * in chat piece b; Stay, 24 October 2026).
 */

/**
 * ZOOM IS A MULTIPLE OF FIT WIDTH. `1` is a page as wide as the column, the
 * reader's opening state; minus and plus step through these, and the middle
 * control goes back to 1.
 */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

export function zoomIn(zoom: number): number {
  return ZOOM_STEPS.find((step) => step > zoom + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
}

export function zoomOut(zoom: number): number {
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - 1e-6) ?? ZOOM_STEPS[0];
}

export function canZoomIn(zoom: number): boolean {
  return zoom < ZOOM_STEPS[ZOOM_STEPS.length - 1] - 1e-6;
}

export function canZoomOut(zoom: number): boolean {
  return zoom > ZOOM_STEPS[0] + 1e-6;
}

/** "Fit" at 1, else the multiple as a percentage of fit width: "150%". */
export function zoomLabel(zoom: number): string {
  return Math.abs(zoom - 1) < 1e-6 ? 'Fit' : `${Math.round(zoom * 100)}%`;
}

/**
 * The pdf.js scale for a page `pageWidth` points wide in a column `columnWidth`
 * CSS pixels wide, at `zoom`. A column not measured yet (0) gives a page at
 * its own size, so the first frame is never a zero-sized page.
 */
export function pageScale(columnWidth: number, pageWidth: number, zoom: number): number {
  if (!(pageWidth > 0)) return zoom;
  const fit = columnWidth > 0 ? columnWidth / pageWidth : 1;
  return fit * zoom;
}

/**
 * Canvas pixels per CSS pixel: the screen's density, capped at 2, and lowered
 * so a page never exceeds `MAX_CANVAS_PIXELS` (an iPhone refuses a canvas
 * past about 16.7 million pixels and draws nothing).
 */
export const MAX_CANVAS_PIXELS = 16_000_000;

export function canvasRatio(cssWidth: number, cssHeight: number, devicePixelRatio: number): number {
  const wanted = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  const area = cssWidth * cssHeight;
  if (!(area > 0)) return wanted;
  return Math.min(wanted, Math.sqrt(MAX_CANVAS_PIXELS / area));
}

/** "1 page", "12 pages". */
export function pageCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'page' : 'pages'}`;
}

/**
 * Why a PDF did not open, as the reader says it. pdf.js names its failures
 * (`error.name`): `PasswordException` for a locked file, `InvalidPDFException`
 * for a broken one, `ResponseException` with the file host's `status` for a
 * refused or missing download. A signed link that has expired answers 403 or
 * 400, so those ask for a fresh link (`relink`) before saying anything.
 */
export type PdfFailure =
  | { kind: 'password'; message: string; retry: false }
  | { kind: 'broken'; message: string; retry: false }
  | { kind: 'gone'; message: string; retry: false }
  | { kind: 'relink'; message: string; retry: true }
  | { kind: 'failed'; message: string; retry: true };

export function pdfFailure(error: unknown): PdfFailure {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  if (name === 'PasswordException') {
    return {
      kind: 'password',
      message: 'This PDF is locked with a password, so it cannot be shown here. Download it and open it with its password.',
      retry: false,
    };
  }
  if (name === 'InvalidPDFException') {
    return {
      kind: 'broken',
      message: 'This PDF is damaged or is not a real PDF, so it cannot be shown here. You can still download it.',
      retry: false,
    };
  }
  if (name === 'ResponseException' && status === 404) {
    return { kind: 'gone', message: 'This file is no longer available.', retry: false };
  }
  if (name === 'ResponseException' && (status === 400 || status === 403)) {
    return { kind: 'relink', message: 'The link to this PDF has expired.', retry: true };
  }
  return { kind: 'failed', message: 'The PDF did not load. Try again, or download it.', retry: true };
}
