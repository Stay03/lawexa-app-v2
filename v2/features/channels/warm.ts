import type { QueryClient } from '@tanstack/react-query';

import { channelsQueries } from './queries';
import { findCachedMessage } from './cache';

/**
 * warmChannelHistory — fetch the newest page of a channel's transcript BEFORE
 * the reader opens it, so the message a notification is about is already there
 * when the screen paints.
 *
 * ── THE COMPLAINT ──────────────────────────────────────────────────────────
 * Owner, 2026-08-14: "when I see a notification that I have a new message. If I
 * open the channel/thread I don't see the new message immediately at the bottom
 * it takes a quick second before I see that message at the bottom, can't the app
 * load it in the back so when I check it's already there instead of appearing
 * right in front of my eyes."
 *
 * ── WHY IT WAS LATE ────────────────────────────────────────────────────────
 * The full body of a message is broadcast only on the presence room of the
 * channel that is on screen, which `room.ts` joins on mount and leaves on
 * unmount. App wide the client hears `.channel.unread`, which carries the
 * channel, the message uuid and the counts and, in the wire contract's own
 * words, never any content. So the spine knew THAT something had arrived and
 * never WHAT. The transcript is deliberately never stale, so opening the
 * channel painted the last known rows instantly and correctly — without the new
 * message — and the only thing that went to get it was the reconcile that runs
 * when the room joins, i.e. after the screen had already drawn. The reader
 * watches the row arrive. That is the "quick second".
 *
 * This closes it on the event we already receive. Slack's own account of the
 * same problem is the precedent: "If at any time you get a new message in a
 * channel, we can pre-fetch history and practically guarantee the channel will
 * be synced before you view it" — ranked, capped, one small page per channel.
 * Telegram and WhatsApp do not need this because their event carries the
 * message itself; the backend ask that would put us in that class is written in
 * this phase's plan, and nothing here depends on it.
 *
 * ── IT ALSO PUTS THE UNREAD LINE IN THE RIGHT PLACE ────────────────────────
 * The gold divider's position is `messages.length - unread_count`, computed
 * once and frozen for the view session. Against a transcript missing its newest
 * rows, the count and the rows disagree and the line lands above messages that
 * were already read. Warming makes them agree before the freeze.
 */

/** One warm per channel per window. A busy channel must never become a fetch
 *  per message; this is the same shape as the spine's per-space cold-fallback
 *  ledger, keyed per channel because that is the unit being warmed. */
const WARM_MIN_INTERVAL_MS = 15_000;
const warmedAtByChannel = new Map<string, number>();

/** Has the reader asked the browser to spend less data? Then nothing here is
 *  worth doing: they will pay for this page again when they open the channel.
 *  `connection` is still not in every engine's lib.dom, so it is read
 *  defensively rather than cast to `any`. */
function saveDataOn(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  return connection?.saveData === true;
}

export function warmChannelHistory(
  queryClient: QueryClient,
  {
    channelUuid,
    messageUuid,
    viewerId,
    force = false,
  }: {
    channelUuid: string;
    /** The message that must end up in the cache. When it is already there,
     *  there is nothing to warm. */
    messageUuid: string | null;
    viewerId: number | null;
    /** A mention, or a notification the reader has actually pressed: skip the
     *  throttle, because this is the channel they are about to open. */
    force?: boolean;
  },
): void {
  const options = channelsQueries.messages({ channelUuid, viewerId, around: null });

  // SOMEBODY IS LOOKING AT IT. The room owns the open channel: its socket
  // writers put arrivals into this exact cache entry. A fetch started here
  // would race them, and that race has a known ending — a response taken before
  // the event silently overwrites the socket's write when it resolves
  // (TanStack/query#3579, closed as wontfix). Observers are the honest way to
  // ask "is this on screen", and they cost nothing to read.
  const watched = queryClient
    .getQueryCache()
    .findAll({ queryKey: channelsQueries.messagesOf(channelUuid) })
    .some((query) => query.getObserversCount() > 0);
  if (watched) return;

  if (messageUuid && findCachedMessage(queryClient, channelUuid, messageUuid)) return;
  if (saveDataOn()) return;

  const now = Date.now();
  if (!force) {
    const last = warmedAtByChannel.get(channelUuid) ?? 0;
    if (now - last < WARM_MIN_INTERVAL_MS) return;
  }
  warmedAtByChannel.set(channelUuid, now);

  // COLD: nothing is cached for this channel, so one page one request is the
  // whole job. `prefetchInfiniteQuery` swallows its own errors, which is what
  // makes it right for work nobody asked for.
  if (queryClient.getQueryData(options.queryKey) === undefined) {
    void queryClient.prefetchInfiniteQuery(options);
    return;
  }

  // WARM BUT STALE: the entry exists and does not have this message. The
  // options carry `staleTime: Infinity` — socket events are meant to be the
  // staleness signal — so a prefetch would decline to do anything at all; this
  // call overrides that for this one fetch.
  //
  // `pages: 1` IS DELIBERATE, AND IT TRUNCATES. A plain refetch of an infinite
  // entry re-downloads every page the reader ever loaded, so the cost would
  // scale with how deep they once scrolled in a channel they are not even
  // looking at. Fetching one page rebuilds the entry as that page alone; older
  // pages come back when they scroll up, and a reader returning to a channel
  // lands at the bottom anyway. A fresh head beats retained depth for an entry
  // nobody is watching.
  void queryClient
    .fetchInfiniteQuery({ ...options, staleTime: 0, pages: 1 })
    .catch(() => {
      // Warming is best effort by definition: the screen fetches for itself.
    });
}
