/**
 * read-on-open — opening a report marks it read, ONCE PER OPENING, decided
 * from the state the report was opened in, never from a later change to it.
 *
 * ── THE BUG IT REPLACES (Tester, live, 26 October 2026) ─────────────────────
 * The page used to mark read whenever the report it showed was unread and it
 * had not marked it yet. A report opened ALREADY READ never set that flag, so
 * pressing Mark unread (which clears `read_at` at once, optimistically) made
 * the page "open" it again: PATCH {read:false} then PATCH {read:true} in the
 * same second, and the report stayed read. Now the first time the opened
 * report is known to be complete, the page decides, and the decision is final
 * for that opening, whatever the reader does next.
 *
 * Pure, so the test can run it; the report screen holds the decision in a ref.
 */

export type ReadOnOpen = 'wait' | 'mark-read' | 'leave';

/**
 * What the page does about the read state, given whether this opening has
 * decided yet and the report as it now stands. `wait` until a completed
 * report is in hand (a running scan is followed to its end first).
 */
export function readOnOpen(
  decided: boolean,
  scan: { status: string; read_at: string | null } | null,
): ReadOnOpen {
  if (decided || scan === null || scan.status !== 'completed') return decided ? 'leave' : 'wait';
  return scan.read_at === null ? 'mark-read' : 'leave';
}
