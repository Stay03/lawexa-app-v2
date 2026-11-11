/**
 * The pieces every share card drawn on the device uses: Wrapped's poster
 * (`lib/wrapped/share-image.ts`) and the live quiz's result card
 * (`v2/features/channels/quiz/result-card.ts`). A card is drawn straight onto
 * a canvas rather than captured from the page, so the PNG is the same on
 * every phone whatever its screen size or zoom, and it is handed to the
 * phone's share sheet as a file, or saved.
 */

/** Loads a picture for the canvas; null when it cannot (no CORS, offline), and the card leaves it out. */
export function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** The canvas as a PNG file, for the share sheet and Save image. */
export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? new File([blob], name, { type: 'image/png' }) : null), 'image/png');
  });
}

/** Saves a drawn card (an object URL) to the device's downloads. */
export function download(url: string, name: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Copies text to the clipboard; false when the browser refuses (no permission, an insecure page). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser's share sheet takes a picture. Read at tap time, never in render. */
export function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });
}
