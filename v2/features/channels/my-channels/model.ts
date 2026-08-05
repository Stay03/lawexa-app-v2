import type { Channel } from '@/types/collab';
import { channelUnreadGrammar } from '../model';

/**
 * my-channels model — the pure vocabulary of the `/channels` triage screen:
 * the three lenses, their URL parsing, and the two predicates the list is
 * narrowed by. No JSX and no hooks, so the screen, its skeleton and any future
 * consumer read one definition.
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
 * derived once, in the same place the rows derive their paint.
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

/** Whether a channel belongs under this lens. */
export function matchesLens(channel: Channel, lens: MyChannelsLens): boolean {
  if (lens === 'all') return true;
  const { unread, mentions } = channelUnreadGrammar(channel);
  return lens === 'unread' ? unread : mentions > 0;
}

/**
 * Whether a channel answers the search box.
 *
 * NAME AND SPACE ONLY, deliberately. The row also previews the last message,
 * and matching that text would make results appear whose visible title has
 * nothing to do with what was typed — a search whose hits cannot be explained
 * by looking at them. Two channels called "general" are told apart by their
 * space, which is exactly why the space name is in scope.
 */
export function matchesChannelSearch(channel: Channel, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return (
    channel.name.toLowerCase().includes(needle) ||
    channel.space.name.toLowerCase().includes(needle)
  );
}
