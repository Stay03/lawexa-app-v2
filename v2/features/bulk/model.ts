/**
 * bulk — the pure rules of acting on several items at once (Arthur, 20
 * October 2026, 21:41Z: "implement bulk selection across all seven screens,
 * but keep the actions context-specific"). No React, so every screen reads
 * the same answers and the tests pin them with plain values.
 *
 * THE SERVER (backend, bulk-actions-part1): `POST /bulk/{screen}` takes 1 to
 * 50 items and answers each one as its own route would, with
 * `{results: [{id, ok, code, message}], done, failed}`. Select-all sends the
 * list's ids, so a long list goes in batches of {@link BULK_MAX}, and the
 * batches' answers are added together into one outcome.
 */

/** Items one request takes (the server's `BulkItemRunner::MAX_ITEMS`). */
export const BULK_MAX = 50;

/** What a result names: a route key (a uuid or an id), or an item's `{type, id}`. */
export type BulkItemId = string | number | { type: string; id: string | number };

export interface BulkItemResult {
  id: BulkItemId;
  ok: boolean;
  /** The HTTP status the item's own route would have answered. */
  code: number;
  message: string;
}

export interface BulkResult {
  results: BulkItemResult[];
  done: number;
  failed: number;
}

/** The items in batches the server takes. */
export function batches<T>(items: readonly T[], size: number = BULK_MAX): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size) out.push(items.slice(start, start + size));
  return out;
}

/** Several batches' answers as one. */
export function mergeResults(parts: readonly BulkResult[]): BulkResult {
  const results = parts.flatMap((part) => part.results);
  const done = results.filter((result) => result.ok).length;
  return { results, done, failed: results.length - done };
}

/* ── The selection ─────────────────────────────────────────────────────────── */

/** A row ticked or unticked. Returns a new set; the old one is left as it was. */
export function toggled<K>(selection: ReadonlySet<K>, key: K): ReadonlySet<K> {
  const next = new Set(selection);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * The select-all box: ticks every row of the CURRENT list (Arthur: "limited
 * to the current list or folder"), or unticks them all when every one is
 * already ticked.
 */
export function selectAllToggled<K>(selection: ReadonlySet<K>, keys: readonly K[]): ReadonlySet<K> {
  if (keys.length > 0 && keys.every((key) => selection.has(key))) return new Set();
  return new Set(keys);
}

/** The select-all box's own state: none, some or all of the list ticked. */
export function selectAllState<K>(selection: ReadonlySet<K>, keys: readonly K[]): boolean | 'indeterminate' {
  const ticked = keys.filter((key) => selection.has(key)).length;
  if (ticked === 0) return false;
  return ticked === keys.length ? true : 'indeterminate';
}

/** Ticked rows that are no longer in the list (deleted, moved away) are dropped. */
export function prunedTo<K>(selection: ReadonlySet<K>, keys: readonly K[]): ReadonlySet<K> {
  const present = new Set(keys);
  const kept = [...selection].filter((key) => present.has(key));
  return kept.length === selection.size ? selection : new Set(kept);
}

/* ── What the reader is told ───────────────────────────────────────────────── */

/** "1 item" / "12 items", "1 file" / "3 files". */
export function countOf(count: number, noun: { one: string; many: string }): string {
  return `${count} ${count === 1 ? noun.one : noun.many}`;
}

export interface BulkVerb {
  /** "Deleted", "Moved", "Removed". */
  past: string;
  /** "deleted", "moved", "removed": after "couldn't be". */
  pastLower: string;
}

/**
 * One sentence for the outcome. All went: "Moved 12 items." Some did not:
 * "Moved 9 of 12 items. 3 couldn't be moved: <the server's reason>." None
 * did: "None of the 12 items could be moved: <reason>." The reason is the
 * first failure's own message, so a refusal reads as it would for one item.
 */
export function bulkOutcome(result: BulkResult, verb: BulkVerb, noun: { one: string; many: string }): string {
  const total = result.done + result.failed;
  const reason = result.results.find((item) => !item.ok && item.message.trim())?.message.trim();
  const tail = reason ? `: ${reason.replace(/\.$/, '')}.` : '.';
  if (result.failed === 0) return `${verb.past} ${countOf(total, noun)}.`;
  if (result.done === 0) {
    return total === 1
      ? `The ${noun.one} couldn't be ${verb.pastLower}${tail}`
      : `None of the ${countOf(total, noun)} could be ${verb.pastLower}${tail}`;
  }
  return `${verb.past} ${result.done} of ${countOf(total, noun)}. ${result.failed} couldn't be ${verb.pastLower}${tail}`;
}
