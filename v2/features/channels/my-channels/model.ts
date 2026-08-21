import type { Channel } from '@/types/collab';
import { channelUnreadGrammar, compareRoomRecency, roomActivityAt } from '../model';
import { channelDisplayName } from '../thread-model';

/**
 * my-channels model — the pure vocabulary of the `/channels` triage screen:
 * the three lenses, their URL parsing, the two predicates the list is narrowed
 * by, and the merge that puts threads in it. No JSX and no hooks, so the
 * screen, its skeleton and any future consumer read one definition.
 *
 * ── EVERY LENS IS CLIENT-SIDE, AND THAT IS LOAD-BEARING ────────────────────
 * `channelsQueries.mine({ viewerId })` is the EXACT cache entry the realtime
 * spine mounts app-wide, which is why arriving here paints in the first frame
 * with no request. Passing a filter or a search term as a REQUEST PARAMETER
 * would fork a second cache entry (the params object is part of the key) and
 * mint a fetch on every visit — the one thing this screen must not do. So the
 * lenses filter the rows the spine already holds, and `GET /api/channels`
 * keeps being called exactly once, by the spine, for everyone.
 *
 * ── THE LENSES ARE THE UNREAD GRAMMAR, NOT A SECOND OPINION ────────────────
 * `unread` and `mentions` are read through {@link channelUnreadGrammar}, so a
 * muted channel is absent from Unread (mute kills the rollup) and present in
 * Mentions when it holds a direct @you (mute never kills that) — Ruling A,
 * derived once, in the same place the rows derive their paint. Threads answer
 * the SAME test by the same function, because a thread IS a channel on the
 * wire, so the two kinds can never disagree about what earns a lens.
 *
 * ── SECOND LIST, ONE SCREEN (2026-08-16) ───────────────────────────────────
 * `GET /channels` applies `topLevel()` and returns channels only, so a reader
 * tagged in a THREAD met a screen with previews everywhere and no row for the
 * thread that tagged them - the same hole the space lobby had, reported again
 * with a screenshot. `GET /threads` is the cross-space twin of that listing and
 * returns the same `ChannelResource` rows; {@link mergeMyRooms} is where the
 * two halves become one ranked list.
 */

export type MyChannelsLens = 'all' | 'unread' | 'mentions';

/** The lens strip, in display order. `id` is what rides `?lens=`. */
export const MY_CHANNEL_LENSES: readonly { id: MyChannelsLens; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
];

/** Read the lens out of the URL. Anything unrecognised resolves to `all`, so a
 *  hand-edited link degrades to the whole list instead of an empty screen. */
export function parseMyChannelsLens(raw: string | null | undefined): MyChannelsLens {
  switch (raw) {
    case 'unread':
    case 'mentions':
      return raw;
    default:
      return 'all';
  }
}

/** Whether a room - channel or thread - belongs under this lens. */
export function matchesLens(room: Channel, lens: MyChannelsLens): boolean {
  if (lens === 'all') return true;
  const { unread, mentions } = channelUnreadGrammar(room);
  return lens === 'unread' ? unread : mentions > 0;
}

/**
 * Whether a room answers the search box.
 *
 * WHAT IS ON THE ROW, AND ONLY THAT. The row also previews the last message,
 * and matching that text would make results appear whose visible title has
 * nothing to do with what was typed — a search whose hits cannot be explained
 * by looking at them. Two channels called "general" are told apart by their
 * space, which is exactly why the space name is in scope.
 *
 * A THREAD IS MATCHED ON ITS TITLE, NEVER ON `name`. A thread's `name` is the
 * generated slug `thread--{uuid}`, so matching it would let the string "thread"
 * return every tangent in the account while the words a reader can actually see
 * returned nothing. {@link channelDisplayName} is the one function that knows
 * which of the two a given row has; for a channel it is the name, so channel
 * behaviour is byte-identical.
 *
 * THE PARENT CHANNEL IS IN SCOPE for the same "explainable by looking at it"
 * rule: the thread row prints "Thread in General", so a hit on "General" is
 * visible on the row it returned - and searching a channel's name usefully
 * brings back the tangents branched out of it.
 */
export function matchesChannelSearch(room: Channel, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return (
    channelDisplayName(room).toLowerCase().includes(needle) ||
    room.space.name.toLowerCase().includes(needle) ||
    (room.parent_channel_name?.toLowerCase().includes(needle) ?? false)
  );
}

/**
 * The stable empty default for the threads half, for the beat before the query
 * answers and for the beats where it never will (refused, or not enabled).
 * Falling back to a fresh `[]` would hand the screen's merge memo a new
 * dependency on every render and re-rank the whole list for nothing.
 */
export const NO_MY_THREADS: readonly Channel[] = [];

/**
 * The two halves of `/channels` as ONE list, newest first.
 *
 * ── WHY THIS RE-RANKS AT ALL ───────────────────────────────────────────────
 * This screen used to state that it never re-orders: the server ranks
 * `GET /channels` and the date headings are cut into that ranking. Merging a
 * SECOND server-ranked list ends that, and there is no way around it - two
 * lists each sorted by newest activity are not one list sorted by newest
 * activity, and interleaving them is precisely the point. So the merge ranks,
 * with {@link compareRoomRecency}, which is the same rule and the same
 * `last_message_at ?? created_at` clock both thread routes order by and the
 * space lobby's digest merges on. One list, one clock, agreeing with the
 * server rather than arguing with it.
 *
 * ONE RULE, NOT TWO. Ranking only when a thread happens to exist would give the
 * screen two orderings and make an empty account's list a different artefact
 * from a busy one's. The one visible consequence for a thread-less account is
 * that a channel created today with nothing said in it now dates from its
 * creation instead of sinking under "Earlier", which is the more honest of the
 * two answers.
 */
export function mergeMyRooms(
  channels: readonly Channel[],
  threads: readonly Channel[],
): Channel[] {
  return [...channels, ...threads].sort(compareRoomRecency);
}

/* ── Grouped view: a channel, and its threads underneath it ────────────────── */

/** How many threads are drawn under a heading before the rest collapse. */
export const THREADS_PER_CHANNEL = 3;

/**
 * One heading and the threads under it.
 */
export interface MyChannelGroup {
  /** The heading itself. */
  channel: Channel;
  /** Its threads, newest first, capped at {@link THREADS_PER_CHANNEL}. */
  threads: Channel[];
  /**
   * The rest of the threads we hold for it, newest first — what "See more"
   * reveals. Held rather than discarded so pressing the button costs nothing
   * and shows no skeleton: these rows are already in memory.
   */
  rest: Channel[];
  /**
   * Threads we HOLD for this channel and are not drawing. NOT the true
   * remainder: the screen only ever holds the newest page of threads, so a
   * channel can have more that never arrived. `0` therefore means "nothing
   * more that we know of", never "nothing more". The button says "See more"
   * rather than a number until the server sends a real count per channel.
   */
  hiddenHeld: number;
  /** The clock this heading is ranked on. See {@link groupMyRooms}. */
  activityAt: string;
}

/**
 * The two halves of `/channels` as CHANNELS WITH THEIR THREADS UNDER THEM.
 *
 * ── WHY (the owner, 20 August 2026) ────────────────────────────────────────
 * "I want the threads to be under the channel for every channel. If the channel
 * has too many threads then there should be see more. The point is that
 * visually if I see that a thread is under a channel I understand the hierarchy
 * but still the most recent shows top."
 *
 * {@link mergeMyRooms} puts both kinds in one flat ranked list, where a thread
 * and a channel sit as equals and the only clue a thread belongs to Product
 * Development is a line of grey text under its name. You have to READ to work
 * out the shape. This states it instead.
 *
 * ── THE HEADING IS RANKED ON THE NEWEST THING INSIDE IT ────────────────────
 * And this is the whole screen, not a detail. A channel's own
 * `last_message_at` moves only when somebody posts IN THE CHANNEL — posting in
 * one of its threads never touches it (measured, and confirmed by the backend
 * author, 20 August 2026). So ranking headings on the channel's own clock sinks
 * the busiest room in the app: Product Development's own last message can be
 * hours older than the thread that moved a minute ago.
 *
 * The owner's rule was "the most recent shows top". Ranking on the channel
 * alone breaks that rule while looking like it obeys it, which is the worst of
 * both. So a heading is ranked on the newest of itself and everything under it.
 *
 * ── A THREAD ALWAYS GETS A HEADING ─────────────────────────────────────────
 * If a thread's parent is somehow not in the channel list, the thread is NOT
 * dropped: a stand-in heading is built from the parent name and uuid the thread
 * already carries. On this screen that should not happen — the list is filtered
 * to rooms you belong to, and access to a thread rides on its parent. But
 * "should not happen" is not "cannot": the backend author first stated a thread
 * always sits in a channel you are in, checked it properly, and corrected
 * himself — SEEING a thread only requires the parent to be VISIBLE, not joined,
 * so a reader can be in a thread whose channel they never joined. Dropping a
 * row in that case would hide a conversation rather than mis-file it.
 *
 * ── ORDER WITHIN A HEADING IS THE SAME RULE, DELIBERATELY ──────────────────
 * Newest first, no special treatment for a thread that mentions you. The owner
 * was asked whether mentions should be pulled into the visible three so one can
 * never hide behind the button, and has not answered; his stated rule is strict
 * recency, so that is what this does. If that changes it is a comparator, not a
 * rebuild.
 */
export function groupMyRooms(
  channels: readonly Channel[],
  threads: readonly Channel[],
): MyChannelGroup[] {
  const byParent = new Map<string, Channel[]>();
  const orphans: Channel[] = [];

  for (const thread of threads) {
    const parent = thread.parent_channel_uuid;
    if (!parent) {
      orphans.push(thread);
      continue;
    }
    const bucket = byParent.get(parent);
    if (bucket) bucket.push(thread);
    else byParent.set(parent, [thread]);
  }

  const groups: MyChannelGroup[] = [];
  const seenParents = new Set<string>();

  for (const channel of channels) {
    seenParents.add(channel.uuid);
    groups.push(buildGroup(channel, byParent.get(channel.uuid) ?? []));
  }

  /* Threads whose parent never appeared in the channel list. Grouped by that
     parent so two tangents of the same absent channel share one heading rather
     than each growing their own. */
  for (const [parentUuid, bucket] of byParent) {
    if (seenParents.has(parentUuid)) continue;
    groups.push(buildGroup(standInChannel(bucket[0], parentUuid), bucket));
  }

  /* A thread carrying no parent at all cannot be filed under anything, so it
     stands alone rather than vanishing. */
  for (const thread of orphans) {
    groups.push({
      channel: thread,
      threads: [],
      rest: [],
      hiddenHeld: 0,
      activityAt: roomActivityAt(thread),
    });
  }

  return groups.sort(
    (left, right) =>
      Date.parse(right.activityAt) - Date.parse(left.activityAt) ||
      channelDisplayName(left.channel).localeCompare(channelDisplayName(right.channel)),
  );
}

function buildGroup(channel: Channel, bucket: readonly Channel[]): MyChannelGroup {
  const ordered = [...bucket].sort(compareRoomRecency);
  const newest = ordered.reduce(
    (latest, thread) => {
      const at = roomActivityAt(thread);
      return Date.parse(at) > Date.parse(latest) ? at : latest;
    },
    roomActivityAt(channel),
  );
  return {
    channel,
    threads: ordered.slice(0, THREADS_PER_CHANNEL),
    rest: ordered.slice(THREADS_PER_CHANNEL),
    hiddenHeld: Math.max(0, ordered.length - THREADS_PER_CHANNEL),
    activityAt: newest,
  };
}

/**
 * A heading for a channel we were never handed, built from what its thread
 * already carries. Everything a heading needs is on the thread: the parent's
 * name, its uuid, and the space it lives in.
 *
 * The counts are ZEROED rather than copied. A thread's unread belongs to the
 * thread and is drawn on the thread's own row; letting it ride up would count
 * the same messages twice on one screen.
 */
function standInChannel(thread: Channel, parentUuid: string): Channel {
  return {
    ...thread,
    uuid: parentUuid,
    name: thread.parent_channel_name ?? 'Channel',
    is_thread: false,
    parent_channel_uuid: null,
    parent_channel_name: null,
    title: null,
    unread_count: 0,
    mention_count: 0,
  };
}
