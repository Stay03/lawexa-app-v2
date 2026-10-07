import { exportApi } from '@/lib/api/export';
import { statusOf } from '@/v2/runtime/persist/policy';
import type { DocumentExportTarget } from './export-target';

/**
 * Download one document block of a saved answer as a Word file through the
 * API's export route. Resolves with `null` when the file was handed to the
 * browser, or with a short message to show when it was not.
 */
export async function downloadDocx(target: DocumentExportTarget): Promise<string | null> {
  try {
    const { blob, filename } = await exportApi.messageBlockDocx(target);
    saveBlob(blob, filename);
    return null;
  } catch (error) {
    const status = statusOf(error);
    // A 422 means this screen and the server counted the blocks differently
    // (export-target.ts), which is our bug, not the reader's: the reader gets
    // the plain message, the console gets the server's reason.
    if (status === 422) console.warn('Word export refused (422):', await serverReason(error), target);
    return exportErrorMessage(status);
  }
}

/** What the reader is told when the export fails, by HTTP status (the route's contract). */
export function exportErrorMessage(status: number | undefined): string {
  if (status === 401) return 'Sign in to download this document.';
  if (status === 404) return 'This document is no longer available to download.';
  if (status === 429) return 'Too many downloads. Try again in a minute.';
  // 422 (the block is not in the saved answer), 500 and network failures.
  return 'The download failed. Try again.';
}

/**
 * The server's reason on a failed export. The request asks for a file, so an
 * error body arrives as a Blob holding the API's JSON; the route puts the
 * reason in `errors.block` (backend, 7 October 2026), else in `message`.
 */
export async function serverReason(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  try {
    const text = data instanceof Blob ? await data.text() : typeof data === 'string' ? data : JSON.stringify(data);
    const body = JSON.parse(text) as { message?: unknown; errors?: { block?: unknown } };
    const block = Array.isArray(body.errors?.block) ? body.errors.block[0] : body.errors?.block;
    if (typeof block === 'string') return block;
    if (typeof body.message === 'string') return body.message;
    return text;
  } catch {
    return 'no readable reason in the response';
  }
}

/** Hands a file to the browser's download, then frees the object URL. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
