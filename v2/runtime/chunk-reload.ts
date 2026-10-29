/**
 * chunk-reload — a page that crashed because a code chunk is gone reloads
 * itself once (the techlead, 30 October 2026, after one "The chat screen
 * crashed: ChunkLoadError." report on 29 October at 15:19Z).
 *
 * A tab opened before a deploy still asks for the old build's chunks, which
 * the new deploy no longer serves. The error screen's "Try again" re-renders
 * the same tree, asks for the same missing chunk and fails again, so the
 * reader was left on the crash screen until they reloaded by hand. A reload
 * fetches the new build.
 *
 * ONCE PER PATH PER MINUTE. A stamp in sessionStorage holds when this path
 * last reloaded for it; within 60 s the screen shows instead, so a real
 * outage (the chunks really cannot load) never loops. Storage that throws
 * (a private window, blocked site data) means no reload: the screen shows.
 */

/** How long a path's reload stamp holds. */
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

const STAMP_PREFIX = 'lawexa-chunk-reload:';

/** The webpack and browser wordings of a code or style chunk that failed to load. */
const CHUNK_MESSAGES = ['Loading chunk', 'Loading CSS chunk', 'Failed to fetch dynamically imported module'];

/** Whether the error is a chunk that failed to load. */
export function isChunkLoadError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = error.message ?? '';
  return CHUNK_MESSAGES.some((part) => message.includes(part));
}

/** The storage a stamp is kept in: `sessionStorage`'s two methods. */
export interface StampStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Whether this path may reload now, and if so, the stamp is written. `false`
 * when it reloaded for a chunk within the last minute, or when the storage
 * cannot be read or written.
 */
export function claimChunkReload(storage: StampStorage | null, path: string, now: number): boolean {
  if (!storage) return false;
  try {
    const key = `${STAMP_PREFIX}${path}`;
    const last = Number(storage.getItem(key));
    if (Number.isFinite(last) && last > 0 && now - last < CHUNK_RELOAD_WINDOW_MS) return false;
    storage.setItem(key, String(now));
    return true;
  } catch {
    return false;
  }
}
