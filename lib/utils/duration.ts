/**
 * Human-readable scan duration: seconds-only under a minute (e.g. "45s"),
 * minutes-and-seconds above it ("1m 30s"), with whole minutes collapsing the
 * trailing "0s" ("2m").
 */
export function formatScanDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}
