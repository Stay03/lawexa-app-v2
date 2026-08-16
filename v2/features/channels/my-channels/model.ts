import type { Channel } from '@/types/collab';
import { channelUnreadGrammar, compareRoomRecency } from '../model';
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
