import type { ExportedFile } from '@/lib/api/export';

/**
 * Hands a downloaded file to the browser's download, then frees the object URL.
 * Safari on iOS opens the file asynchronously, so the URL is kept for a minute.
 */
export function saveExportedFile(file: ExportedFile): void {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
