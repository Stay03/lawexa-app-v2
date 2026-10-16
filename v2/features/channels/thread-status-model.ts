import type {
  Channel,
  Message,
  ThreadStatus,
  ThreadStatusCounts,
  ThreadStatusValue,
} from '@/types/collab';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';

/**
 * thread-status-model — the pure vocabulary of a thread's status (Stay, 15-16
 * October 2026: the design "locked in" from the thread-status mock). No JSX and
 * no hooks: the chip, the header control, the Threads sheet's filter row and
 * the feed's status line all read their words from here, so none of them can
 * name a status its own way.
 *
 * ── ABSENT IS NOT `null` ───────────────────────────────────────────────────
 * `status: null` is a thread with no status; a payload with no `status` key at
 * all is a server that predates the feature. The second must draw exactly what
 * was drawn before the feature existed (no chip, no control, no filter row), so
 * every helper that decides whether to draw anything takes the field as it
 * arrived and tests for `undefined` first.
 */

/** The five values, in the order every list of them is drawn. */
export const THREAD_STATUS_VALUES: readonly ThreadStatusValue[] = [
  'running',
  'waiting',
  'blocked',
  'done',
  'closed',
];

const LABELS: Readonly<Record<ThreadStatusValue, string>> = {
  running: 'Running',
  waiting: 'Waiting',
  blocked: 'Blocked',
  done: 'Done',
  closed: 'Closed',
};

export interface ThreadStatusOption {
  /** `null` is "No status", which clears it. */
  value: ThreadStatusValue | null;
  label: string;
  /** The one line under the label in the menu and the sheet. */
  hint: string;
}

/**
 * The six choices in the header's menu and the phone's sheet. The hints are
 * the mock's words; Closed says "Finished and filed" and nothing about leaving
 * the list, because a Closed thread STAYS in the list (Stay, 16 October 2026),
 * greyed.
 */
export const THREAD_STATUS_OPTIONS: readonly ThreadStatusOption[] = [
  { value: null, label: 'No status', hint: 'Nothing to track' },
  { value: 'running', label: 'Running', hint: 'Someone is working on it' },
  { value: 'waiting', label: 'Waiting', hint: 'Needs an answer from someone' },
  { value: 'blocked', label: 'Blocked', hint: 'Cannot move until something is fixed' },
  { value: 'done', label: 'Done', hint: 'Finished; still open for replies' },
  { value: 'closed', label: 'Closed', hint: 'Finished and filed' },
];

export function isThreadStatusValue(value: unknown): value is ThreadStatusValue {
  return (
    typeof value === 'string' &&
    (THREAD_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/** The word for a value. The app's own words, so a chip drawn from a feed
 *  line's bare `metadata.to` reads the same as one drawn from a full status. */
export function threadStatusLabel(value: ThreadStatusValue): string {
  return LABELS[value];
}

/** "2m ago", "just now", or `''` before the clock has a reading. */
function agoPhrase(iso: string, now: number): string {
  const age = now > 0 ? formatRelativeTime(iso, now) : '';
  if (!age) return '';
  return age === 'now' ? 'just now' : `${age} ago`;
}

/**
 * The footer under the menu: who set the status and when.
 *
 *  - "Set to Running by Ada · 2m ago"
 *  - "Set to Running by Lawexa for Ada · 2m ago" when an agent made the change
 *    (`changed_by` is then the person it acted for)
 *  - "Set to Running · 2m ago" once the account behind it is gone
 *
 * The age drops out while `now` is 0 (before the minute clock hydrates).
 */
export function threadStatusFooter(status: ThreadStatus, now: number): string {
  const name = status.changed_by?.name?.trim() || null;
  let line = `Set to ${threadStatusLabel(status.value)}`;
  if (status.via === 'agent') {
    line += name ? ` by Lawexa for ${name}` : ' by Lawexa';
  } else if (name) {
    line += ` by ${name}`;
  }
  const ago = agoPhrase(status.changed_at, now);
  return ago ? `${line} · ${ago}` : line;
}

/**
 * "quiet 1d" after the chip of a Running or Waiting thread the server marks
 * stale; `null` otherwise. The age is the thread's last message, or the status
 * change when the thread has none; while the clock has no reading it is just
 * "quiet".
 */
export function threadStatusQuiet(
  thread: Pick<Channel, 'status' | 'last_message_at'>,
  now: number,
): string | null {
  const status = thread.status;
  if (!status || !status.is_stale) return null;
  if (status.value !== 'running' && status.value !== 'waiting') return null;
  const since = thread.last_message_at ?? status.changed_at;
  const age = now > 0 ? formatRelativeTime(since, now) : '';
  return age && age !== 'now' ? `quiet ${age}` : 'quiet';
}

/** A Closed thread keeps its row, with its title in muted ink. */
export function isClosedThread(thread: Pick<Channel, 'status'>): boolean {
  return thread.status?.value === 'closed';
}

/* ── The Threads sheet's status filter ─────────────────────────────────── */

/** One chip in the filter row. `null` is "Any status". */
export type ThreadStatusFilter = ThreadStatusValue | null;

export const THREAD_STATUS_FILTERS: readonly ThreadStatusFilter[] = [
  null,
  ...THREAD_STATUS_VALUES,
];

export function threadStatusFilterLabel(filter: ThreadStatusFilter): string {
  return filter === null ? 'Any status' : threadStatusLabel(filter);
}

/** What the list request sends: nothing for Any, one value otherwise. */
export function threadStatusFilterParam(
  filter: ThreadStatusFilter,
): readonly ThreadStatusValue[] | undefined {
  return filter === null ? undefined : [filter];
}

/**
 * The number printed on a filter chip, or `null` for none. Counts come from
 * the parent channel's `thread_status_counts`, which count EVERY thread, so
 * they are shown on All only: on Following they would describe a list the
 * reader is not looking at. Any status carries no number.
 */
export function threadStatusFilterCount(
  filter: ThreadStatusFilter,
  counts: ThreadStatusCounts | undefined,
  following: boolean,
): number | null {
  if (filter === null || following || !counts) return null;
  const count = counts[filter];
  return typeof count === 'number' ? count : null;
}

/**
 * Whether the filter row is drawn. The row is drawn when the server shows it
 * knows about statuses: the parent carries `thread_status_counts`, or a loaded
 * row carries a `status` key (even `null`). A filter already chosen keeps the
 * row too, so an empty filtered list can still be switched back. Against a
 * server that predates the feature none of these hold and the sheet is as it
 * was.
 */
export function showsThreadStatusFilter(
  channel: Pick<Channel, 'thread_status_counts'>,
  rows: readonly Pick<Channel, 'status'>[],
  filter: ThreadStatusFilter,
): boolean {
  if (filter !== null) return true;
  if (channel.thread_status_counts !== undefined) return true;
  return rows.some((row) => row.status !== undefined);
}

/* ── The feed's status line ────────────────────────────────────────────── */

/** What a `thread_status_changed` line says, read off one message. */
export interface ThreadStatusChange {
  from: ThreadStatusValue | null;
  to: ThreadStatusValue | null;
  note: string | null;
  /** The person, or for an agent change the person it acted for. */
  byName: string | null;
  via: 'app' | 'agent';
  at: string;
  /** The server's own sentence, shown as it came. */
  sentence: string;
}

/**
 * Read a status-change line, or `null` when the message is not one.
 *
 * THE MARKER IS `metadata.type`, never the author: these rows carry
 * `author: null` and `is_ai: false`, exactly like a join line (backend, 16
 * October 2026). An unknown `to` or `from` value reads as `null`, so a value
 * this app does not know yet draws the sentence with no chip rather than a
 * chip with no word.
 */
export function statusChangeOf(message: Message): ThreadStatusChange | null {
  const meta = message.metadata;
  if (meta.type !== 'thread_status_changed') return null;
  return {
    from: isThreadStatusValue(meta.from) ? meta.from : null,
    to: isThreadStatusValue(meta.to) ? meta.to : null,
    note: meta.note?.trim() || null,
    byName: meta.actor_name?.trim() || null,
    via: meta.via === 'agent' ? 'agent' : 'app',
    at: message.created_at,
    sentence: message.content.trim(),
  };
}

/* ── The PATCH's refusals ──────────────────────────────────────────────── */

/**
 * The sentence to show inline when setting a status fails: the field error
 * when there is one (`errors.status` for a bad value or a channel that is not
 * a thread, `errors.note` for a long note), else the server's message.
 */
export function threadStatusErrorText(error: {
  message: string;
  errors: Record<string, string[]> | null;
}): string {
  const field = error.errors?.status?.[0] ?? error.errors?.note?.[0];
  return field || error.message;
}
