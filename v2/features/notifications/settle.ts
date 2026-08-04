import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/types/notification';
import { notificationChannelUuid, notificationMark } from './presentation';
import { notificationsQueries } from './queries';

/**
 * SETTLE THE BELL AFTER A CHANNEL READ (backend reply, 2026-08-04).
 *
 * `POST /channels/{uuid}/read` now does two things: it moves the channel's read
 * pointer AND marks read every unread notification pointing into that channel
 * at or before the marked message. Mentions and replies, never invitations, and
 * a mention NEWER than the pointer deliberately stays unread. The client is not
 * told any of that happened — the response is `{last_read_message_uuid,
 * unread_count}`, which is about the CHANNEL's badge, not the bell's.
 *
 * ── WHY AN INVALIDATION AND NOT A TARGETED CACHE WRITE ────────────────────
 * A targeted write needs to know WHICH rows the server cleared, and the honest
 * answer is that we cannot compute it. The rule is "at or before the marked
 * message" — an ordering over MESSAGES. A notification row carries
 * `message_uuid`, and uuids do not order; the bell holds only the pages it has
 * loaded, so an affected row may not be cached at all. Marking rows read
 * locally would therefore be a guess, and a guess that SILENCES a mention is
 * the one failure this spine exists to prevent. So we ask the one party that
 * knows. The count is the authority; we only decide WHEN it is worth asking.
 *
 * ── THE GATE: A QUESTION WHOSE ANSWER CAN CHANGE ──────────────────────────
 * The read pointer advances constantly — every dwell on a newer message while
 * a live conversation is on screen — so "is anything unread?" is the wrong
 * question. It is permanently true for anyone holding one pending invitation,
 * and a channel read can NEVER clear an invitation, so that reader would pay
 * an invalidation every few seconds for ten minutes and change nothing. The
 * question has to be: is there anything unread THIS read could plausibly have
 * cleared. Four gates, cheapest first:
 *
 *  1. THE ZERO GATE. Cached bell count of 0 ⇒ nothing unread anywhere. Skip.
 *     (An ABSENT count is not a zero — unknown means ask.)
 *  2. THE REACH GATE ({@link unreadReach}). Reads the bell's own cached rows
 *     and asks whether any UNREAD one points into this channel.
 *  3. THE CHANGE GATE. Has anything changed since we last asked for this
 *     channel? If the bell count is the number we already settled against,
 *     re-asking cannot produce a different answer — a row this read could
 *     clear would have DECREMENTED that count when it was cleared. A new
 *     arrival moves it (the spine invalidates the LIVE count query on every
 *     `.notification` broadcast), which re-opens the gate by itself. So a
 *     channel costs ONE request per change, not one per pointer advance,
 *     however unresolvable its rows are.
 *  4. A COALESCING THROTTLE, leading edge with a trailing flush. The first
 *     read settles immediately (opening a channel you were mentioned in is
 *     precisely when the badge must drop), and reads inside the window
 *     collapse into ONE follow-up at the window's end. No advance is ever
 *     dropped without a later reconcile.
 *
 * ── WHAT A SETTLE ACTUALLY DOES, INCLUDING WITH THE PANEL OPEN ────────────
 * The bell is a Popover over the very screen doing the reading, so "the list
 * is inactive while you read a channel" is not true — it is active whenever
 * the reader has the panel open. An invalidation of the list key would then
 * refetch EVERY loaded page and re-sort rows under a cursor that is already
 * moving toward one. So the two keys are settled differently and deliberately:
 *
 *  - THE COUNT is invalidated normally. It is one small GET, it is the badge
 *    the whole feature is about, and it changes a number, not a target.
 *  - THE ROWS are marked stale with `refetchType: 'none'` — never refetched
 *    by a settle. An open panel keeps exactly the rows it is showing, and
 *    picks up the new read state on its next open (or window focus). A row
 *    that looks unread for a few seconds longer is harmless: clicking it marks
 *    it read again, and `POST /notifications/{id}/read` is idempotent. A list
 *    that reorders under a click is not harmless.
 *
 * Module scope = one ledger per tab, deliberately: the throttle and the
 * per-channel change record must survive the unmount/remount of any channel
 * screen, and every caller shares one QueryClient.
 */

const SETTLE_WINDOW_MS = 5_000;

let windowOpenedAt = 0;
let trailingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The bell count each channel was last settled against — the CHANGE GATE's
 * memory. `null` records "we settled while the count was unknowable". Bounded
 * by the number of channels this tab reads in one session.
 */
const settledAtCountByChannel = new Map<string, number | null>();

/** The bell's cached unread total, or null when the bell has never loaded it. */
function readUnreadCount(queryClient: QueryClient): number | null {
  const cached = queryClient.getQueryData<UnreadCountResponse>(
    notificationsQueries.unreadCount().queryKey,
  );
  return cached?.data.unread_count ?? null;
}

/**
 * Could a read of THIS channel have cleared any unread row the bell holds?
 *  - `reaches`      yes — at least one unread row points into this channel.
 *  - `cannot-reach` provably no — every unread row the server counts is in
 *                   our cache, and none of them points here.
 *  - `unknown`      we cannot tell, so the caller must ask the server.
 */
type UnreadReach = 'reaches' | 'cannot-reach' | 'unknown';

/**
 * WHICH ROWS A CHANNEL READ CAN TOUCH AT ALL. The backend clears rows
 * "pointing into that channel" and states outright that invitations are never
 * touched — so only a channel MESSAGE notification is in scope, and that is
 * exactly the mention/reply pair. An invitation, a radar report or an admin
 * broadcast is skipped without making the verdict unknown, which is what lets
 * the invitation-holder's session cost nothing.
 */
function isClearableByChannelRead(notification: Notification): boolean {
  const mark = notificationMark(notification);
  return mark === 'mention' || mark === 'reply';
}

function unreadReach(
  queryClient: QueryClient,
  channelUuid: string,
  unreadCount: number | null,
): UnreadReach {
  const cached = queryClient.getQueryData<
    InfiniteData<NotificationListResponse>
  >(notificationsQueries.infiniteList().queryKey);
  // The panel has never been opened, so the bell holds no rows to reason over.
  if (!cached) return 'unknown';

  let unreadSeen = 0;
  for (const page of cached.pages) {
    for (const row of page.data) {
      if (row.read_at) continue;
      unreadSeen += 1;
      if (!isClearableByChannelRead(row)) continue;
      const rowChannel = notificationChannelUuid(row);
      // A PRE-DEPLOY ROW WITH NO IDS AND NO DEEP LINK is the one case we
      // cannot resolve: it is a channel notification (its own `type` says so)
      // that will not say WHICH channel. Calling that "not this channel"
      // would leave the bell counting something the server has already
      // cleared, so it is unknown — and the CHANGE GATE is what stops unknown
      // from meaning "ask forever".
      if (rowChannel === null) return 'unknown';
      if (rowChannel === channelUuid) return 'reaches';
    }
  }

  // Provable only when the rows we hold account for every unread the server
  // counts; otherwise there are unread rows off the loaded pages.
  return unreadCount !== null && unreadSeen >= unreadCount
    ? 'cannot-reach'
    : 'unknown';
}

/**
 * Ask the server, and remember what we asked against. The count is recorded
 * only after a SUCCESSFUL refetch — a failed one leaves the gate open so the
 * next read retries instead of the bell staying wrong until refocus.
 */
function settleNow(queryClient: QueryClient, channelUuid: string): void {
  void queryClient
    .invalidateQueries({
      queryKey: notificationsQueries.unreadCount().queryKey,
    })
    .then(() => {
      settledAtCountByChannel.set(channelUuid, readUnreadCount(queryClient));
    })
    .catch(() => {
      // Nothing recorded: the next read pointer asks again.
    });

  // Stale, never refetched — see the docblock on why an open panel must keep
  // the rows it is showing.
  void queryClient.invalidateQueries({
    queryKey: notificationsQueries.lists(),
    refetchType: 'none',
  });
}

/**
 * Call after a channel read pointer lands. Cheap, synchronous, and safe to
 * call on every successful mark.
 */
export function settleNotificationsAfterChannelRead(
  queryClient: QueryClient,
  channelUuid: string,
): void {
  const unreadCount = readUnreadCount(queryClient);
  if (unreadCount === 0) return;

  if (unreadReach(queryClient, channelUuid, unreadCount) === 'cannot-reach') {
    return;
  }
  // The change gate applies to a positive reach too, and must: a settle does
  // not refetch the rows, so a cached row that pointed here still reads as
  // unread on the next advance. Without this it would answer `reaches`
  // forever and re-open the very herd this module exists to close.
  if (settledAtCountByChannel.get(channelUuid) === unreadCount) return;

  const now = Date.now();
  const sinceWindowOpened = now - windowOpenedAt;
  if (sinceWindowOpened >= SETTLE_WINDOW_MS) {
    windowOpenedAt = now;
    settleNow(queryClient, channelUuid);
    return;
  }
  // Inside the window: one flush is already queued, or this call queues it.
  if (trailingTimer !== null) return;
  trailingTimer = setTimeout(() => {
    trailingTimer = null;
    windowOpenedAt = Date.now();
    settleNow(queryClient, channelUuid);
  }, SETTLE_WINDOW_MS - sinceWindowOpened);
}
