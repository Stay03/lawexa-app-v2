import type { Channel } from '@/types/collab';
import { channelUnreadGrammar } from '@/v2/features/channels/model';
import {
  channelDisplayName,
  threadUnreadState,
  type ThreadUnreadState,
} from '@/v2/features/channels/thread-model';
import type {
  RailRow,
  RailSections,
} from '@/v2/features/collab/shell/collab-route';
import type { UnreadGrammar } from '@/v2/features/collab/unread-grammar';

/**
 * activity-digest — the lobby's "Active here" list: one space's CHANNELS and
 * THREADS merged into a single ranking, newest activity first. Pure: no JSX,
 * no hooks, so the block and any future preview read the same answers.
 *
 * ── WHY THREADS BELONG IN THIS LIST AT ALL ─────────────────────────────────
 * `GET /spaces/{uuid}` counts threads in its §17 rollups (`mention_count`
 * sums EVERY channel, threads included - the backend author ruled on
 * 2026-08-12 that they stay in), but `GET /spaces/{uuid}/channels` applies
 * `topLevel()` and returns channels only. Measured on the owner's main space,
 * 2026-08-14: the space said 54 mentions while the one busy channel row said
 * 9. So the lobby showed a number larger than everything it could display,
 * with no row for the other 45 to sit on. The owner's chosen fix: threads and
 * channels in ONE list here, newest first, so the thread that lit the badge
 * is one tap away.
 *
 * The RAIL and the DRAWER deliberately stay channels-only - threads have no
 * rail row by design (`ThreadsSheet` is the channel-level surface for them),
 * which is why this ranking lives with the lobby and not in `collab-route`.
 *
 * ── ONE RANKING: RECENCY WITHIN THE SECTIONS' OWN TIERS ────────────────────
 * Unread first (that is the triage), then the quiet rooms by recency, then
 * the muted ones - the exact tiers `buildRailSections` already decided, so
 * this list and the rail can never disagree about what counts as unread.
 * Threads join the SAME tiers by the SAME test (`channelUnreadGrammar`): a
 * muted thread sinks exactly as a muted channel does, and a thread with a
 * mention triages exactly as a channel with one does. Within every tier the
 * order is newest first, so a thread with a mention badge IS the first row
 * whenever it is the newest thing - the whole point of the merge.
 *
 * It is NOT `sections.ordered`. The rail keeps its quiet section alphabetical
 * so rows never move under the cursor while the reader is aiming at one; this
 * digest is read top-down and then left, so recency is the right order here
 * and nothing is being aimed at.
 *
 * ── MUTED ROOMS ARE LAST, NOT ABSENT ───────────────────────────────────────
 * Excluding them was wrong in a way that only showed on a phone: below the
 * docked rail's breakpoint the lobby is the space's ONLY channel list, so a
 * reader who had muted everything saw "Active here" empty while every room
 * they own sat one drawer-tap away with nothing saying so. They come last and
 * the row dims them, which is what a mute means - quieter, never hidden.
 */

/**
 * ── THE THREADS ARE INJECTED, AND THIS IS THE STABLE EMPTY DEFAULT ─────────
 * The route is LIVE (2026-08-16): `GET /spaces/{uuid}/threads` mirrors
 * `GET /spaces/{uuid}/channels` and returns the SAME `ChannelResource` rows we
 * already type as `Channel` - `is_thread: true`, `title`,
 * `parent_channel_uuid`, `parent_channel_name`, `last_message_at`, plus the
 * viewer-scoped `is_member`, `unread_count`, `mention_count` and
 * `my_notify_level` stamped exactly as the channel listings stamp them. It is
 * read through `channelsQueries.threadsBySpace`, mounted by `SpaceScreen`.
 *
 * WHAT THIS CONSTANT IS FOR NOW is the beat before that query answers - and the
 * beats where it never will, because the reader was refused or the request has
 * not been enabled. `SpaceActivityBlock` memoises the whole ranking on
 * `[sections, threads]`, so falling back to a fresh `[]` would hand that memo a
 * new dependency on every render and re-sort three arrays for nothing. One
 * frozen reference, and the memo holds.
 *
 * The cross-space twin `GET /threads` is live too and keyed
 * (`channelsQueries.myThreads`), but no screen reads it yet - "My channels" is
 * its own change.
 */
export const NO_SPACE_THREADS: readonly Channel[] = [];

/** A channel in the digest - the same `RailRow` the rail and drawer draw,
 *  so `SpaceChannelRow` renders it untouched and its `memo` keeps holding. */
export interface ChannelDigestRow {
  kind: 'channel';
  row: RailRow;
}

/** A thread in the digest. Both derivations ride along so the row component
 *  re-decides nothing. */
export interface ThreadDigestRow {
  kind: 'thread';
  thread: Channel;
  /**
   * Tier, dim and badge - from `channelUnreadGrammar`, the SAME function that
   * decides a channel's, because a thread IS a channel on the wire and a mute
   * must sink and dim it identically (and, per Ruling A, must never suppress
   * its @you badge).
   */
  grammar: UnreadGrammar;
  /**
   * Title tone - the three-state grammar `ThreadsSheet` and `ThreadLine`
   * already speak (`none` / `caught-up` / `behind`), so a reader who learnt
   * it under a message reads this row for free. The grammar above answers
   * "where does the row sit"; this answers "does the reader belong in it".
   */
  state: ThreadUnreadState;
}

export type ActivityDigestRow = ChannelDigestRow | ThreadDigestRow;

export interface ActivityDigest {
  /** At most `limit` rows, in the order they are drawn. */
  rows: readonly ActivityDigestRow[];
  /**
   * The section heading's worded fact: "12 channels · 3 threads · 5 unread".
   * Worded, never a bare numeral - in this product a loose number beside a
   * gold badge would be read as a second badge, and a number is only ever
   * mentions. "Unread" counts BOTH kinds, so the sentence cannot claim less
   * than the rows below it show; the thread fact is omitted while no threads
   * are known, so today's heading is byte-identical to what it said before
   * threads existed here.
   */
  meta: string;
}

/**
 * When this room last MOVED: its newest message or, for a room nobody has
 * spoken in yet, the moment it was created.
 *
 * THE `?? created_at` IS THE NULL CASE, AND IT IS LOAD-BEARING. A brand-new
 * thread carries `last_message_at: null` (a standalone one may hold it for
 * days), and ranking on that field alone - as the rail's own `activityRank`
 * does - would sink every newborn thread to the bottom of a list whose one
 * promise is "newest first". The backend ordering for
 * `GET /spaces/{uuid}/threads` falls back to `created_at` for exactly this
 * row, and this merge must agree with it or the two orders fight on every
 * refetch. Applied to both kinds on principle (one list, one rule): for a
 * channel it fires only when nothing was ever said there, where creation
 * genuinely is the latest activity.
 */
function activityRank(
  room: Pick<Channel, 'last_message_at' | 'created_at'>,
): number {
  const iso = room.last_message_at ?? room.created_at;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function roomOf(row: ActivityDigestRow): Channel {
  return row.kind === 'channel' ? row.row.channel : row.thread;
}

/** Newest first; ties break on the DISPLAY name - `channelDisplayName`, never
 *  `name`, because a thread's `name` is a machine slug nobody should sort by.
 *  For a channel the two are the same string, so channel-only output is
 *  unchanged. */
function byRecency(left: ActivityDigestRow, right: ActivityDigestRow): number {
  const a = roomOf(left);
  const b = roomOf(right);
  const delta = activityRank(b) - activityRank(a);
  return delta !== 0
    ? delta
    : channelDisplayName(a).localeCompare(channelDisplayName(b));
}

function asChannelRow(row: RailRow): ActivityDigestRow {
  return { kind: 'channel', row };
}

/** "1 channel" / "3 threads" - the heading's worded facts. */
function countLabel(count: number, noun: 'channel' | 'thread'): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Merge one space's channel sections and its threads into the digest. Pure. */
export function buildActivityDigest(
  sections: RailSections,
  threads: readonly Channel[],
  limit: number,
): ActivityDigest {
  const unread: ActivityDigestRow[] = sections.unread.map(asChannelRow);
  const rest: ActivityDigestRow[] = sections.rest.map(asChannelRow);
  const muted: ActivityDigestRow[] = sections.muted.map(asChannelRow);

  for (const thread of threads) {
    // The SAME partition test `buildRailSections` applies to a channel, so
    // the two kinds cannot disagree about what earns the unread tier.
    const grammar = channelUnreadGrammar(thread);
    const row: ThreadDigestRow = {
      kind: 'thread',
      thread,
      grammar,
      state: threadUnreadState(thread),
    };
    if (grammar.muted) muted.push(row);
    else if (grammar.unread || grammar.mentions > 0) unread.push(row);
    else rest.push(row);
  }

  unread.sort(byRecency);
  rest.sort(byRecency);
  muted.sort(byRecency);

  const facts = [countLabel(sections.total, 'channel')];
  if (threads.length > 0) facts.push(countLabel(threads.length, 'thread'));
  if (unread.length > 0) facts.push(`${unread.length} unread`);

  return {
    rows: [...unread, ...rest, ...muted].slice(0, limit),
    meta: facts.join(' · '),
  };
}
