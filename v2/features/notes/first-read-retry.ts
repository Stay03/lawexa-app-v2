import { isAxiosError } from 'axios';

/**
 * first-read-retry — how the draft panel's two note reads (the chat's draft
 * notes list, and the note itself) retry before they say the note couldn't be
 * reached (the techlead, 30 October 2026, after Lucy's recheck at 01:46Z).
 *
 * The note is made by a queued job just after the answer, so the panel's first
 * read can come before it exists (a 404), and a deploy can drop a request
 * outright (no answer). Both get two more tries, after 1.5 s and then 3 s,
 * before the panel shows "Your note couldn't be reached" and its Try again.
 * Any other 4xx is a settled answer and is not retried; a 5xx gets one retry,
 * as every other notes read does.
 */

/** The two waits before the retries, in order. */
export const NOTE_FIRST_READ_DELAYS_MS: readonly number[] = [1500, 3000];

/** Whether a failed note read is tried again. `failureCount` counts the failures before this one. */
export function retryNoteFirstRead(failureCount: number, error: unknown): boolean {
  const status = isAxiosError(error) ? (error.response?.status ?? 0) : 0;
  // No answer at all (a dropped request), or not there yet (the job is still writing it).
  if (status === 0 || status === 404) return failureCount < NOTE_FIRST_READ_DELAYS_MS.length;
  if (status >= 400 && status < 500) return false;
  return failureCount < 1;
}

/** The wait before retry number `attempt` (0 first). */
export function noteFirstReadDelay(attempt: number): number {
  return NOTE_FIRST_READ_DELAYS_MS[Math.min(attempt, NOTE_FIRST_READ_DELAYS_MS.length - 1)];
}
