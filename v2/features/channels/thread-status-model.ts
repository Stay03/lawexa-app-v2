import type {
  Channel,
  Message,
  SetThreadStatusPayload,
  ThreadStatus,
  ThreadStatusCounts,
  ThreadStatusValue,
} from '@/types/collab';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';

/**
 * thread-status-model — the pure vocabulary of a thread's status. First "locked
 * in" by Stay (15-16 October 2026, the thread-status mock); the values, words
 * and rules revised by Arthur the same day: Working, Needs Action, On Hold,
 * Completed, Closed, no way back to "no status", and Needs Action naming who
 * needs to act. Queued came that evening (Stay: "open new thread and start
 * this"): the work is agreed and waits for someone to start it, so it comes
 * first, before Working, and it never goes stale. No JSX and no hooks: the chip, the header control, the Threads
 * sheet's filter row, the channel rows' counts and the feed's status line all
 * read their words from here, so none of them can name a status its own way.
 *
 * ── ABSENT IS NOT `null`, AND UNKNOWN IS NEITHER ──────────────────────────
 * `status: null` is a thread with no status; a payload with no `status` key at
 * all is a server that predates the feature. The second must draw exactly what
 * was drawn before the feature existed (no chip, no control, no filter row).
 * A status whose value this app does not know draws no chip and never throws:
 * every surface reads it through {@link knownThreadStatus}.
 *
 * ── THE SERVER OWNS THE ORDER ─────────────────────────────────────────────
 * All three thread lists come back sorted by urgency (Needs Action, Working,
 * Queued, On Hold, no status, Completed, Closed; newest inside each). Nothing here
 * sorts, and the cache writers patch rows where they stand: a changed row
 * moves group on the next fetch, never on its own.
 */

/** The six values, in order of a thread's life (Queued before Working, then
 *  Arthur's order), which every list of them follows. */
export const THREAD_STATUS_VALUES: readonly ThreadStatusValue[] = [
  'queued',
  'working',
  'needs_action',
  'on_hold',
  'completed',
  'closed',
];

const LABELS: Readonly<Record<ThreadStatusValue, string>> = {
  queued: 'Queued',
  working: 'Working',
  needs_action: 'Needs Action',
  on_hold: 'On Hold',
  completed: 'Completed',
  closed: 'Closed',
};

export interface ThreadStatusOption {
  value: ThreadStatusValue;
  label: string;
  /** The one line under the label in the menu and the sheet. */
  hint: string;
}

/**
 * The six choices in the header's menu and the phone's sheet, with Arthur's
 * one-line meanings (Queued's is the techlead's, from Stay's ask). There is no "No status": a status, once set, cannot be
 * cleared (the server refuses `null`).
 */
export const THREAD_STATUS_OPTIONS: readonly ThreadStatusOption[] = [
  { value: 'queued', label: 'Queued', hint: 'The work is agreed and waits for someone to start it.' },
  { value: 'working', label: 'Working', hint: 'Work is underway.' },
  {
    value: 'needs_action',
    label: 'Needs Action',
    hint: 'Someone needs to respond, review, make a decision or take the next step.',
  },
  { value: 'on_hold', label: 'On Hold', hint: 'Work is deliberately paused.' },
  {
    value: 'completed',
    label: 'Completed',
    hint: 'The work is finished, but the thread may remain open for follow-up.',
  },
  { value: 'closed', label: 'Closed', hint: 'The thread is formally concluded.' },
];

export function isThreadStatusValue(value: unknown): value is ThreadStatusValue {
  return (
    typeof value === 'string' &&
    (THREAD_STATUS_VALUES as readonly string[]).includes(value)
  );
}

/** The status, if this app knows its value; `null` for none AND for unknown. */
export function knownThreadStatus(
  status: ThreadStatus | null | undefined,
): ThreadStatus | null {
  return status && isThreadStatusValue(status.value) ? status : null;
}

/** The word for a value. The app's own words, so a chip drawn from a feed
 *  line's bare `metadata.to` reads the same as one drawn from a full status. */
export function threadStatusLabel(value: ThreadStatusValue): string {
  return LABELS[value];
}

/** Who needs to act, on a Needs Action status that names one; else `null`. */
export function threadStatusPerson(status: ThreadStatus | null): string | null {
  if (!status || status.value !== 'needs_action') return null;
  return status.needs_action_from?.name?.trim() || null;
}

/**
 * The person in a thread HEADER's pill: the first word of their name ("User2"
 * for "User2 Tester"), a one-word name whole (Arthur, 17 October 2026: "first
 * name", so more of the title shows beside the pill). The status menu, the
 * rows, the Threads sheet and the timeline keep the full name, and the
 * header's spoken label still says it whole.
 */
export function threadStatusHeaderPerson(status: ThreadStatus | null): string | null {
  return threadStatusPerson(status)?.split(/\s+/)[0] ?? null;
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
 *  - "Set to Working by Ada · 2m ago"
 *  - "Set to Working by Lawexa for Ada · 2m ago" when an agent made the change
 *    (`changed_by` is then the person it acted for)
 *  - "Set to Working · 2m ago" once the account behind it is gone
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
 * "quiet 1d" after the chip of a Working or Needs Action thread the server
 * marks stale; `null` otherwise. The age is the thread's last message, or the
 * status change when the thread has none; while the clock has no reading it is
 * just "quiet".
 */
export function threadStatusQuiet(
  thread: Pick<Channel, 'status' | 'last_message_at'>,
  now: number,
): string | null {
  const status = knownThreadStatus(thread.status);
  if (!status || !status.is_stale) return null;
  if (status.value !== 'working' && status.value !== 'needs_action') return null;
  const since = thread.last_message_at ?? status.changed_at;
  const age = now > 0 ? formatRelativeTime(since, now) : '';
  return age && age !== 'now' ? `quiet ${age}` : 'quiet';
}

/** A Closed thread keeps its row, with its title in muted ink. */
export function isClosedThread(thread: Pick<Channel, 'status'>): boolean {
  return knownThreadStatus(thread.status)?.value === 'closed';
}

/* ── Setting a status ──────────────────────────────────────────────────── */

/** What the reader chose: a value, and for Needs Action who and why. */
export interface ThreadStatusChoice {
  status: ThreadStatusValue;
  /** Needs Action only; ignored on any other value. */
  needsActionFrom?: { uuid: string; name: string } | null;
  note?: string | null;
}

/**
 * THE PATCH BODY, BUILT IN ONE PLACE (backend contract, 16 October 2026):
 * `{ status, needs_action_from?, note? }`. `needs_action_from` is the person's
 * user uuid and rides ONLY with Needs Action (anything else is a 422). The
 * note rides with Needs Action, trimmed, `null` when empty; the other values
 * send none, as the first pass did, which leaves the server's note rule alone.
 */
export function buildSetThreadStatusBody(choice: ThreadStatusChoice): SetThreadStatusPayload {
  if (choice.status !== 'needs_action') return { status: choice.status };
  const body: SetThreadStatusPayload = {
    status: 'needs_action',
    note: choice.note?.trim() || null,
  };
  if (choice.needsActionFrom) body.needs_action_from = choice.needsActionFrom.uuid;
  return body;
}

/**
 * Whether a choice is the status the thread already holds, so it sends
 * nothing. Radix calls `onValueChange` for the checked radio item too, and the
 * phone sheet's rows are plain buttons, so without this a press on the current
 * status would send a PATCH and the optimistic write would claim "Set to …
 * just now" for a change nobody made. Needs Action is the same only when the
 * person and the note are the same too.
 */
export function isSameThreadStatus(
  choice: ThreadStatusChoice,
  current: ThreadStatus | null,
): boolean {
  if (!current || choice.status !== current.value) return false;
  if (choice.status !== 'needs_action') return true;
  const person = choice.needsActionFrom?.uuid ?? null;
  const note = choice.note?.trim() || null;
  return (
    person === (current.needs_action_from?.uuid ?? null) &&
    note === (current.note?.trim() || null)
  );
}

/**
 * The sentence to show inline when setting a status fails: the field error
 * when there is one (`errors.status`, `errors.needs_action_from` for a person
 * who cannot post in the thread, `errors.note` for a long note), else the
 * server's message.
 */
export function threadStatusErrorText(error: {
  message: string;
  errors: Record<string, string[]> | null;
}): string {
  const field =
    error.errors?.status?.[0] ??
    error.errors?.needs_action_from?.[0] ??
    error.errors?.note?.[0];
  return field || error.message;
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

/**
 * A channel row's status fact: "2 need action · 1 working" (Arthur, 16
 * October 2026: channel rows show only these two; the sheet's chips show all
 * six). `null` when both are zero or the row carries no counts.
 */
export function channelStatusCountsLine(
  counts: ThreadStatusCounts | undefined,
): string | null {
  if (!counts) return null;
  const parts: string[] = [];
  const needs = counts.needs_action ?? 0;
  const working = counts.working ?? 0;
  if (needs > 0) parts.push(`${needs} ${needs === 1 ? 'needs' : 'need'} action`);
  if (working > 0) parts.push(`${working} working`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/* ── The feed's status line ────────────────────────────────────────────── */

/** What a `thread_status_changed` line says, read off one message. */
export interface ThreadStatusChange {
  from: ThreadStatusValue | null;
  to: ThreadStatusValue | null;
  note: string | null;
  /** The person, or for an agent change the person it acted for. */
  byName: string | null;
  /** Needs Action only: who needs to act. */
  needsActionFromName: string | null;
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
    needsActionFromName: meta.needs_action_from_name?.trim() || null,
    via: meta.via === 'agent' ? 'agent' : 'app',
    at: message.created_at,
    sentence: message.content.trim(),
  };
}

/**
 * Where focus goes in the phone sheet's radio group on a key press: ArrowDown
 * and ArrowUp step and wrap, Home and End jump. `at` is the focused option's
 * index (-1 when focus is elsewhere in the group, which starts at the ends).
 * Focus only; choosing stays on tap, Enter and Space.
 */
export function nextRadioIndex(key: string, at: number, count: number): number {
  if (count <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return at < 0 ? 0 : (at + 1) % count;
  if (key === 'ArrowUp') return at < 0 ? count - 1 : (at - 1 + count) % count;
  return at;
}

/* ── Screen-reader words ───────────────────────────────────────────────── */

const UNIT_WORDS: Readonly<Record<string, string>> = {
  m: 'minute',
  h: 'hour',
  d: 'day',
  w: 'week',
  mo: 'month',
  y: 'year',
};

/** "quiet 1d" → "quiet 1 day", "quiet 3w" → "quiet 3 weeks"; "quiet" stays. */
export function spellQuiet(quiet: string): string {
  const match = /^quiet (\d+)(mo|m|h|d|w|y)$/.exec(quiet);
  if (!match) return quiet;
  const count = Number(match[1]);
  const word = UNIT_WORDS[match[2]];
  return `quiet ${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * The header trigger's name: "Status: Needs Action, Tolu, quiet 1 day. Change
 * status", or "Set status" for a thread without one.
 */
export function threadStatusTriggerLabel(
  status: ThreadStatus | null,
  quiet: string | null,
): string {
  if (!status) return 'Set status';
  const person = threadStatusPerson(status);
  const who = person ? `, ${person}` : '';
  const stale = quiet ? `, ${spellQuiet(quiet)}` : '';
  return `Status: ${threadStatusLabel(status.value)}${who}${stale}. Change status`;
}

/* ── Keeping a parent's counts and its filtered sheet honest ───────────── */

/**
 * Move one thread from `from` to `to` in a parent's `thread_status_counts`,
 * locally, so a status change costs no GET of the parent (checker, 16 October
 * 2026: production holds about four serial requests, and an agent can move
 * many threads at once). `null` is no status, which is not counted, and so is
 * a value this app does not know. The same object comes back when nothing
 * moves; a count never goes below zero.
 */
export function shiftThreadStatusCounts(
  counts: ThreadStatusCounts,
  from: ThreadStatusValue | null,
  to: ThreadStatusValue | null,
): ThreadStatusCounts {
  const known = (value: ThreadStatusValue | null) =>
    isThreadStatusValue(value) ? value : null;
  const before = known(from);
  const after = known(to);
  if (before === after) return counts;
  const next = { ...counts };
  if (before !== null) next[before] = Math.max(0, (next[before] ?? 0) - 1);
  if (after !== null) next[after] = (next[after] ?? 0) + 1;
  return next;
}

/**
 * Whether a cached Threads-sheet entry is filtered by status. Its key is
 * `[...threadsOf(parent), { mine, status }, { viewerId }]` (see `queries.ts`);
 * only a filtered entry can hold a row that no longer matches, so only those
 * are ever re-read after a status change. The unfiltered sheet is patched in
 * place.
 */
export function isStatusFilteredThreadsKey(queryKey: readonly unknown[]): boolean {
  const filters = queryKey[3];
  if (typeof filters !== 'object' || filters === null) return false;
  const status = (filters as { status?: unknown }).status;
  return status !== null && status !== undefined;
}

/**
 * A per-key trailing timer: every `schedule(key)` within `delayMs` of the last
 * one for that key pushes the run back, and the key runs once at the end. Ten
 * status changes on one parent in a burst become one re-read of its filtered
 * sheet. Called from event handlers only, never from render.
 */
export function createTrailingCoalescer(
  delayMs: number,
  run: (key: string) => void,
): (key: string) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (key) => {
    const pending = timers.get(key);
    if (pending !== undefined) clearTimeout(pending);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        run(key);
      }, delayMs),
    );
  };
}
