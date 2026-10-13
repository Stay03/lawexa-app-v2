/**
 * When a chat last had a message, the time every chat list sorts by and shows
 * (Stay, 13 October 2026: "the chat with the most recent message goes to the
 * top"). The server sends `last_message_at` from backend 6f776f0. A server
 * before that sends none, and its lists still sort by `updated_at`, so the row
 * falls back to that and shows the same order it was sorted in.
 */
export function lastActivityAt(row: {
  updated_at: string;
  last_message_at?: string | null;
}): string {
  return row.last_message_at ?? row.updated_at;
}

/** {@link lastActivityAt} as a number for a newest-first sort key. `Date.parse`
 *  is deterministic, so it is safe in render; `NaN` for a bad date. */
export function lastActivityRank(row: {
  updated_at: string;
  last_message_at?: string | null;
}): number {
  return Date.parse(lastActivityAt(row));
}

/** The rows with each id once, the first copy kept. A bump moves a row to the
 *  head of page one; a later page fetched before the server saw the move can
 *  still hold it, and a list must not draw it twice. Same array when no id
 *  repeats. */
export function uniqueRowsById<T extends { id: string | number }>(rows: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out.length === rows.length ? rows : out;
}
