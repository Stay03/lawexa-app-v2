// Shared helpers for the admin job-observability screens.

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** Show a spinner (for in-flight states like running/processing). */
  spinning?: boolean;
}

/** "skipped_no_balance" → "Skipped no balance". */
export function humanizeStatus(status: string): string {
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Build a status→meta resolver from a partial map. Unknown values fall back to
 * a humanized label with a neutral tone, so a new backend status never crashes.
 */
export function makeStatusMeta<S extends string>(
  map: Partial<Record<S, StatusMeta>>
): (status: S | string) => StatusMeta {
  return (status) =>
    map[status as S] ?? { label: humanizeStatus(String(status)), tone: 'neutral' };
}

/** Shared user reference on job rows. */
export interface JobUserRef {
  id: number;
  name: string;
  email: string;
}
