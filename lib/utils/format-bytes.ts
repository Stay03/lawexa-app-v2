/**
 * Format a byte count into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format a byte count the way the case and chat attachment rows always have:
 * full "Bytes" for the smallest unit and up to two decimals ("1.46 KB").
 *
 * It lived in `lib/validations/admin-cases.ts`, which imports zod, so every
 * screen that showed a file size downloaded the validation library with it
 * (the v2 chat's sent-attachment row among them). That module re-exports this
 * one, so its existing callers are unchanged.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}
