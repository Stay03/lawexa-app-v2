/**
 * save-file — how an installed iPhone or iPad app saves a channel file.
 *
 * THE NEW TAB CANNOT SAVE THERE (Arthur, 12 October 2026). Added to the home
 * screen, the app runs standalone, and the tab a file opens in is an in-app
 * view with no way to hand a download to Files: his zips and PDFs opened and
 * went nowhere, while Safari saved the same files. So in that one place the
 * bytes are fetched in the page and handed to the share sheet as a File, whose
 * "Save to Files" (and, for a picture, "Save Image") is the save iOS offers.
 * Every other browser keeps the tab.
 *
 * Pure: the navigator, `matchMedia` and `fetch` are passed in, so the tests run
 * every case without a browser. The hooks that call these live in
 * `./use-file-url.ts`.
 */

/** The parts of the browser the detector reads. `standalone` is Apple's own
 *  flag, set only in a home-screen app, and missing from the DOM types. */
export interface InstalledAppEnvironment {
  navigator: { userAgent: string; maxTouchPoints: number; standalone?: boolean };
  matchMedia: (query: string) => { matches: boolean };
}

/**
 * An iPhone or iPad running this site as a home-screen app.
 *
 * iPADOS ASKS FOR THE DESKTOP SITE, so its user agent says "Macintosh" like a
 * Mac's. The touch screen is what tells them apart: a Mac reports no touch
 * points. Android also runs installed apps standalone, but its tabs save
 * downloads, so it keeps the tab.
 */
export function isInstalledIosApp({ navigator, matchMedia }: InstalledAppEnvironment): boolean {
  const standalone =
    navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!standalone) return false;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

/** What a saved file is called, and its type when the row knows it. Without a
 *  type the file host's own Content-Type is used. */
export interface SaveAs {
  name: string;
  type?: string;
}

/** The two share calls, optional because older engines have neither. */
export interface ShareSheet {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

/**
 * Whether the share sheet takes a file of this name and type. Asked in the tap,
 * with an empty File standing in for the bytes, so a device that would refuse
 * can still take the tab path inside the same gesture.
 */
export function canShareKind(sheet: ShareSheet, saveAs: SaveAs): boolean {
  if (!sheet.canShare || !sheet.share) return false;
  return sheet.canShare({ files: [new File([], saveAs.name, { type: saveAs.type ?? '' })] });
}

/**
 * Fetch a signed URL's bytes as a File under its real name.
 *
 * NO CREDENTIALS. The signature in the URL is the whole authorisation, and the
 * storage bucket allows Lawexa's origins for GET without cookies; a credentialed
 * request would need a stricter answer than the bucket gives.
 */
export async function fetchAsFile(
  url: string,
  saveAs: SaveAs,
  fetcher: typeof fetch = fetch,
): Promise<File> {
  const response = await fetcher(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`The file host answered ${response.status}.`);
  const blob = await response.blob();
  return new File([blob], saveAs.name, { type: saveAs.type || blob.type });
}

/**
 * What became of one share call.
 * - `shared`: the reader picked something in the sheet.
 * - `dismissed`: the reader closed the sheet. A decision, not a fault.
 * - `needs-tap`: the engine wanted a fresh tap. The bytes are still good.
 * - `refused`: the sheet will not take this file, or failed.
 */
export type ShareOutcome = 'shared' | 'dismissed' | 'needs-tap' | 'refused';

/**
 * Offer one file to the share sheet.
 *
 * THE SHEET NEEDS A LIVE TAP. WebKit opens it only within about five seconds
 * of a tap, and the first share call spends that tap. A mint and a download can
 * outlast it, and then the call throws `NotAllowedError`. That answer is
 * `needs-tap`: the caller keeps the File and asks for one more tap, which the
 * engine honours, rather than fetching the bytes again.
 */
export async function shareFile(sheet: ShareSheet, file: File): Promise<ShareOutcome> {
  if (!sheet.canShare || !sheet.share) return 'refused';
  const data: ShareData = { files: [file] };
  if (!sheet.canShare(data)) return 'refused';
  try {
    await sheet.share(data);
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'dismissed';
    if (error instanceof DOMException && error.name === 'NotAllowedError') return 'needs-tap';
    return 'refused';
  }
}
