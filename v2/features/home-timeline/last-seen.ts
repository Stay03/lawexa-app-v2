import type { TimelineType } from './types';

/**
 * last-seen — when the reader last saw each timeline tab, on this device
 * (Stay's UI/UX round, 25 October 2026, fix 8: a "New since your last visit"
 * line between the new rows and the older ones).
 *
 * It is a per-device convenience, so `localStorage` is the right home: a
 * private window, blocked storage or a full quota reads as "never seen" and
 * the line simply does not show. Every access is wrapped for that reason.
 *
 * The value is the newest event's time the reader had on screen (epoch ms),
 * not the device clock, so a skewed clock cannot hide or invent new rows.
 */

/** The storage key for one tab. */
export function lastSeenKey(type: TimelineType): string {
  return `lawexa:v2:home-timeline:last-seen:${type}`;
}

/** Parse a stored value; anything that is not a positive whole number is "never". */
export function parseLastSeen(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function readLastSeen(type: TimelineType): number | null {
  try {
    if (typeof window === 'undefined') return null;
    return parseLastSeen(window.localStorage.getItem(lastSeenKey(type)));
  } catch {
    return null;
  }
}

/** Store `at`, never moving the mark backwards. */
export function writeLastSeen(type: TimelineType, at: number): void {
  try {
    if (typeof window === 'undefined') return;
    const stored = parseLastSeen(window.localStorage.getItem(lastSeenKey(type)));
    if (stored !== null && stored >= at) return;
    window.localStorage.setItem(lastSeenKey(type), String(Math.trunc(at)));
  } catch {
    // Storage refused (private window, quota): the line just will not show.
  }
}
