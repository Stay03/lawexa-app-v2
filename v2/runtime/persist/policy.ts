/**
 * The device cache's rules: which queries are kept on the device, which
 * answers may be kept, which answers delete the kept copy, and how the store is
 * kept small. Pure functions over plain data, so every rule is tested without a
 * browser (device_cache_plan.md, with its two amendments of 6 October 2026).
 */

/**
 * How a query leaf opts in, through `meta.persist`. Nothing is kept unless a
 * leaf says so.
 *
 * - `'list'`: lists and other reads the API does not gate. A kept copy paints
 *   on reopen and is refetched when it is stale, as the leaf's own tier says.
 * - `'gated'`: reads the API gates per reader and per request (a case, a
 *   statute, a note, a folder, a chat). A kept copy may paint, but the read is
 *   ALWAYS sent again on open, so the API's throttle, view count, plan limit
 *   and access checks run exactly as without the cache. A limited, missing or
 *   refused answer then replaces or deletes the kept copy.
 */
export type PersistMode = 'list' | 'gated';

/** Bump when a kept response's shape or a kept leaf's key changes. Rows with
 *  another version are ignored and removed. Not the deploy SHA: that would empty
 *  every device on every deploy. */
export const PERSIST_SCHEMA_VERSION = 1;
/** A kept copy older than this is never painted. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** One answer larger than this is not kept. */
export const PERSIST_MAX_ENTRY_BYTES = 1024 * 1024;
/** At most this many answers per device. */
export const PERSIST_MAX_ROWS = 200;
/** At most this much in total; the oldest answers go first. */
export const PERSIST_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
/** A device read slower than this counts as a miss (a stalled IndexedDB open
 *  must never hold the screen). */
export const PERSIST_READ_TIMEOUT_MS = 1500;

export function persistModeOf(meta: unknown): PersistMode | null {
  const mode = (meta as { persist?: unknown } | undefined)?.persist;
  return mode === 'list' || mode === 'gated' ? mode : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * May this answer be kept on the device? Only a FULL read is kept.
 *
 * - An API envelope with `success: false`, or with no `data`: no.
 * - A case over the reader's plan limit (`limit_exceeded: true`, the API then
 *   sends no body): no.
 * - A note the reader has no access to (`has_access: false`, no `content`): no.
 * - A confidential or redacted chat: never.
 * - A chat whose last message is the reader's own: no. The API saves the reply
 *   only when it finishes, so this is a chat still being answered (or one whose
 *   answer failed). It is kept on the next read, once it is complete.
 *
 * Accepts either the envelope (`{ success, data }`) or the bare record, because
 * some leaves return the envelope and some unwrap it.
 */
export function isStorableAnswer(answer: unknown): boolean {
  const outer = asRecord(answer);
  if (!outer) return answer !== undefined && answer !== null;
  let payload: Record<string, unknown> | null = outer;
  if (typeof outer.success === 'boolean') {
    if (!outer.success) return false;
    if ('data' in outer) {
      if (outer.data === null || outer.data === undefined) return false;
      payload = asRecord(outer.data);
    }
  }
  if (!payload) return true;
  if (payload.limit_exceeded === true) return false;
  if (payload.has_access === false) return false;
  if (payload.is_confidential === true || payload.is_redacted === true) return false;
  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    const last = asRecord(payload.messages[payload.messages.length - 1]);
    if (last?.role === 'user') return false;
  }
  return true;
}

/** The HTTP status on an axios-style or fetch-style error, if any. */
export function statusOf(error: unknown): number | undefined {
  const e = asRecord(error);
  if (!e) return undefined;
  const response = asRecord(e.response);
  const status = response?.status ?? e.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Does this failed read mean the kept copy must go? A 401 (the session is gone;
 * the identity guard wipes the store anyway), 403 (no longer allowed), 404 or
 * 410 (gone, or went private: the API answers a private note with 404), and a
 * chat that turned out to be confidential. A timeout, a 429 or a 5xx keeps the
 * copy: the item has not changed, the request failed.
 */
export function isGoneError(error: unknown): boolean {
  if (asRecord(error)?.name === 'ConfidentialConversationError') return true;
  const status = statusOf(error);
  return status === 401 || status === 403 || status === 404 || status === 410;
}

export interface StoredRowSize {
  key: string;
  bytes: number;
  /** When the row was written (ms). */
  at: number;
}

/**
 * The keys to delete so the store fits both caps: oldest first, until there
 * are at most `maxRows` rows and at most `maxBytes` bytes.
 */
export function trimPlan(
  rows: readonly StoredRowSize[],
  maxRows: number = PERSIST_MAX_ROWS,
  maxBytes: number = PERSIST_MAX_TOTAL_BYTES,
): string[] {
  const oldestFirst = [...rows].sort((a, b) => a.at - b.at);
  let count = oldestFirst.length;
  let bytes = oldestFirst.reduce((sum, row) => sum + row.bytes, 0);
  const remove: string[] = [];
  for (const row of oldestFirst) {
    if (count <= maxRows && bytes <= maxBytes) break;
    remove.push(row.key);
    count -= 1;
    bytes -= row.bytes;
  }
  return remove;
}

/**
 * A short fingerprint of the reader's plan, from `GET /subscriptions/current`.
 * When it changes, every kept answer is dropped: a case, note or statute body
 * kept under one plan must not paint under another (amendment 1).
 * `null` when the answer carries no plan yet; nothing is decided on `null`.
 */
export function planKeyOf(current: unknown): string | null {
  const outer = asRecord(current);
  const data = asRecord(outer && typeof outer.success === 'boolean' ? outer.data : outer);
  if (!data) return null;
  const plan = asRecord(data.plan);
  const subscription = asRecord(data.subscription);
  if (!plan || typeof plan.id !== 'number') return null;
  const status = typeof subscription?.status === 'string' ? subscription.status : 'none';
  return `${plan.id}:${status}:${data.is_free_tier === true ? 'free' : 'paid'}`;
}

/** Bytes a kept answer takes, near enough for the caps (UTF-16 length of its
 *  JSON; ASCII-heavy API text makes this about one byte a character). */
export function sizeOf(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
