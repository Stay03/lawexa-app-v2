import { useSyncExternalStore } from 'react';

/**
 * Times and days in a space chat (Arthur's layout, 14 October 2026): every
 * message shows its time, and a separator names the day when the chat crosses
 * into a new one ("Today", "Yesterday", then the date). All in the reader's
 * own time zone, which is where "today" is.
 */

/** A local calendar day, as a comparable key. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Whether two moments fall on different local days. */
export function isNewDay(previous: Date | null, next: Date): boolean {
  return previous === null || dayKey(previous) !== dayKey(next);
}

/** A separator's words: "Today", "Yesterday", else the date ("Mon 12 Oct",
 *  with the year when it is not this year). `nowMs` 0 (not known yet, the
 *  server's render) always names the date. */
export function dayLabel(date: Date, nowMs: number): string {
  if (nowMs > 0) {
    const today = new Date(nowMs);
    if (dayKey(date) === dayKey(today)) return 'Today';
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  }
  const sameYear = nowMs > 0 && new Date(nowMs).getFullYear() === date.getFullYear();
  // From the parts, so the words are the same with or without the year
  // (Intl puts a comma after the weekday only when the year is there).
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const words = [part('weekday'), part('day'), part('month')];
  return (sameYear ? words : [...words, part('year')]).join(' ');
}

/** A message's clock time: "10:36 AM". */
export function clockTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

const MINUTE_MS = 60_000;

function subscribeToMinutes(onTick: () => void): () => void {
  const id = setInterval(onTick, MINUTE_MS);
  return () => clearInterval(id);
}

/** Now, to the minute, for "Today" and "Yesterday" (a clock store, so no
 *  Date.now() in render). 0 on the server's render. */
export function useNowMinute(): number {
  return useSyncExternalStore(
    subscribeToMinutes,
    () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS,
    () => 0,
  );
}
