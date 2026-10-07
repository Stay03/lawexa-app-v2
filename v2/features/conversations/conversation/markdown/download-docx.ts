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
    return exportErrorMessage(statusOf(error));
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
