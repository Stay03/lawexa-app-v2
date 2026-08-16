'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  focusManager,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  applyChannelCounts,
  type ChannelCountsApplication,
} from '@/v2/features/channels/cache';
import { channelsQueries } from '@/v2/features/channels/queries';
import { warmChannelHistory } from '@/v2/features/channels/warm';
import { channelDisplayName } from '@/v2/features/channels/thread-model';
import { collabAccessState } from '@/v2/features/collab/model';
import { invitationsQueries } from '@/v2/features/invitations/queries';
import { notificationsQueries } from '@/v2/features/notifications/queries';
import {
  applySpaceRollupDeltas,
  invalidateSpaceRollups,
  sumSpaceMentions,
} from '@/v2/features/spaces/cache';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '@/v2/features/spaces/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { resetAppBadge, setAppMentionBadge } from './app-badge';
import { dispatchChannelUnread, type ResolvedChannelContext } from './dispatcher';
import { disconnectV2Echo, getV2Echo } from './echo';
import {
  EVT_CHANNEL_UNREAD,
  userChannelName,
  type ChannelUnreadEvent,
} from './protocol';

/**
 * RealtimeSpine — the ONE app-wide realtime mount for v2 (plan W1 items 1–4,
 * 2026-08-04). Renders nothing. Mounted once in `app/v2/layout.tsx` (inside
 * the query + session providers), so it lives exactly as long as the v2 shell
 * and survives every soft navigation.
 *
 * WHAT IT OWNS:
 *  - the Echo connection lifecycle, keyed on the viewer: the subscription
 *    effect re-runs on the same identity edge `V2CacheIdentityGuard` clears
 *    the cache on, disconnecting the old viewer's socket before the new one's
 *    connects (a socket is viewer-authorized state, exactly like the cache);
 *  - the `users.{uuid}` private listener — `.notification` → blanket
 *    notifications invalidation for EVERY signed-in user (plan W1 item 2: no
 *    role gate), `.channel.unread` → absolute-count writers, space rollup,
 *    then the dispatcher;
 *  - gap recovery — events are fire-and-forget (digest §F.11), so anything
 *    missed is missed for good. TWO triggers, one recovery
 *    ({@link invalidateCollabSurfaces}): a re-established connection, and a
 *    return to a tab that was out of sight long enough for the socket to have
 *    died unnoticed. The second exists because the first arrives far too late
 *    to be the only one — see the effect;
 *  - the app-level badge: total mentions DERIVED from the baseline spaces
 *    query via `select` (a primitive, so the component re-renders only when
 *    the number changes) and pushed to title/favicon/OS badge in an effect.
 *
 * THE TWO BASELINE QUERIES (eligible members only — access state gates them,
 * the "enabled:false while unverified" rule): the spaces list is the badge's
 * source of truth and W4's `/spaces` warm cache; the cross-space `mine` list
 * pre-warms channel rows so `.channel.unread` transitions resolve from cache
 * instead of falling back to invalidation. Both are the same keys the screens
 * read — the owner feel directive's cache-first paints, bought here.
 *
 * COLD-CACHE FALLBACK, THROTTLED: an event for a channel no cache knows can't
 * yield a transition, so the honest move is refetching the server's absolute
 * rollups — but at most once per {@link COLD_FALLBACK_MIN_INTERVAL_MS}, so a
 * message burst against a cold cache can never become a refetch-per-event
 * storm (the exit criterion demands zero refetch loops).
 */

/**
 * Cold-cache rollup refetch throttle — PER SPACE (module scope: one ledger per
 * tab). A single global slot would let one space's cold event starve another
 * space's for the whole window — and the systematically-cold case is the first
 * @you in a MUTED channel, which `GET /channels` excludes from `mine`, so the
 * starved event is exactly the one Ruling A exists to protect (audit W1-M3).
 * Per-space keys keep a burst bound (one refetch per space per window) with no
 * cross-space starvation; the map is bounded by the viewer's space count.
 */
const COLD_FALLBACK_MIN_INTERVAL_MS = 15_000;
const coldFallbackAtBySpace = new Map<string, number>();

/**
 * THE GAP RECOVERY SET: every collab surface fed by socket events, so every
 * surface a delivery gap can leave lying. `channelsQueries.all` is `['channels']`
 * and therefore a prefix of the message-history keys too, which is the point:
 * the live transcript is `STALE_TIMES.realtime` (Infinity), so events are its
 * ONLY freshness signal and no amount of remounting or window focus will ever
 * re-ask on its own.
 */
const COLLAB_GAP_KEYS: readonly QueryKey[] = [
  spacesQueries.all,
  channelsQueries.all,
  notificationsQueries.all,
  invitationsQueries.all,
];

/**
 * Mark every collab surface stale after a window in which events could have
 * been missed. Active consumers refetch through the normal auth path; nothing
 * else pays anything.
 *
 * `cancelRefetch: false` IS LOAD-BEARING. Invalidation defaults to
 * cancel-and-restart, while TanStack's own focus refetch (`Query.onFocus`)
 * dedupes with `cancelRefetch: false`. Both fire on a return to the tab, and
 * which one lands first is an accident of listener order between this component
 * and `QueryClient.mount`. Left at the default, the invalidation would abort and
 * re-send the focus path's in-flight requests (or be aborted by them) every time
 * the reader comes back, so the same list is fetched twice and the first answer
 * is thrown away. Matching the focus path's option makes the two idempotent.
 */
function invalidateCollabSurfaces(queryClient: QueryClient): void {
  for (const queryKey of COLLAB_GAP_KEYS) {
    void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
  }
}

/**
 * How long the app must have been out of sight before a return counts as a gap.
 * Reverb advertises a 30s activity timeout, so a shorter absence is one the
 * socket almost certainly rode out with every event delivered, and re-asking
 * would be noise on a screen that is already correct.
 */
const BACKGROUND_GAP_MS = 30_000;

/**
 * Resolve what the dispatcher must know about the event's channel: the cached
 * row when the writer found one, else ONE channel-detail fetch (the mute
 * oracle — Ruling A must be exact, and the detail carries `my_notify_level`).
 * Resolution failure yields `null`s; the dispatcher's documented
 * deliver-on-unknown rule takes it from there.
 */
async function resolveChannelContext(
  queryClient: QueryClient,
  application: ChannelCountsApplication,
  channelUuid: string,
  viewerId: number | null,
): Promise<ResolvedChannelContext> {
  // A found row answers only when it carries the viewer's level: rows cached
  // before membership (a `bySpace` list) have none, and treating "no level" as
  // resolved would skip the mute oracle exactly where Ruling A needs it
  // (audit W1-M2). The row's name is still good either way.
  if (application.found && application.notifyLevel !== null) {
    return {
      notifyLevel: application.notifyLevel,
      channelName: application.channelName,
    };
  }
  try {
    const response = await queryClient.fetchQuery(
      channelsQueries.detail(channelUuid, { viewerId }),
    );
    return {
      notifyLevel: response.data.my_notify_level ?? null,
      // A mention can land inside a THREAD, whose `name` is a generated slug —
      // so the toast reads the display name, never the row's raw name.
      channelName: channelDisplayName(response.data) || application.channelName,
    };
  } catch {
    return { notifyLevel: null, channelName: application.channelName };
  }
}

/** The full `.channel.unread` pipeline: writers → rollup → dispatcher. */
function handleChannelUnread(
  queryClient: QueryClient,
  event: ChannelUnreadEvent,
  viewerId: number | null,
  navigate: (href: string) => void,
): void {
  // 1. ASSIGN the absolute counts everywhere the channel is cached (never
  //    increment — digest §D; the event is self-healing).
  const application = applyChannelCounts(queryClient, event.channel_uuid, {
    unreadCount: event.unread_count,
    mentionCount: event.mention_count,
  });

  // 2. Roll the transition up to the space row, or refetch absolutes when the
  //    transition is unknowable (throttled — see the module docblock).
  if (application.deltas) {
    applySpaceRollupDeltas(queryClient, event.space_uuid, application.deltas);
  } else {
    const now = Date.now();
    const last = coldFallbackAtBySpace.get(event.space_uuid) ?? 0;
    if (now - last >= COLD_FALLBACK_MIN_INTERVAL_MS) {
      coldFallbackAtBySpace.set(event.space_uuid, now);
      invalidateSpaceRollups(queryClient, event.space_uuid);
      // The unknown channel may also be missing from the row lists entirely
      // (first message in a fresh channel) — let them re-rank/refill too.
      void queryClient.invalidateQueries({ queryKey: channelsQueries.lists() });
    }
  }

  // 3. WARM THE TRANSCRIPT, so the message this event is about is already in
  //    the cache if the reader opens the channel. The event names the channel
  //    and the message but carries no content (protocol.ts), and the transcript
  //    is never stale by design, so without this the row only arrives after the
  //    screen has painted — the owner watching it appear is what this phase is
  //    for. `warm.ts` owns every reason to decline, including the one that
  //    matters here: it never touches a channel somebody is looking at.
  warmChannelHistory(queryClient, {
    channelUuid: event.channel_uuid,
    messageUuid: event.message_uuid ?? null,
    viewerId,
    // A mention is the notification a person actually presses, so it does not
    // wait its turn behind the throttle.
    force: event.is_mention,
  });

  // 4. Toast/sound — mentions only, so the (possibly fetching) resolution is
  //    never paid for plain traffic.
  if (!event.is_mention) return;
  void resolveChannelContext(
    queryClient,
    application,
    event.channel_uuid,
    viewerId,
  ).then((resolved) => dispatchChannelUnread(event, resolved, navigate));
}

export function RealtimeSpine() {
  const session = useV2Session();
  const queryClient = useQueryClient();
  const router = useRouter();
  // The socket needs the uuid (`users.{uuid}`), which the server snapshot does
  // not carry — the sanctioned token bridge does. Primitive selector: stable.
  const userUuid = useAuthStore((state) => state.user?.uuid ?? null);

  const access = collabAccessState(session);
  const eligible = access === 'eligible';
  const viewerId = session.userId;

  // Baseline 1 — the badge's source of truth (and W4's warm spaces list).
  const badgeQuery = useQuery({
    ...spacesQueries.list({ ...SPACES_BASELINE_PARAMS, viewerId }),
    enabled: eligible,
    select: sumSpaceMentions,
  });

  // Baseline 2 — pre-warmed channel rows for transitions + mute lookups (and
  // the `/channels` index key, warm before the user ever visits it).
  useQuery({ ...channelsQueries.mine({ viewerId }), enabled: eligible });

  const mentionTotal = eligible ? (badgeQuery.data ?? 0) : 0;

  useEffect(() => {
    setAppMentionBadge(mentionTotal);
  }, [mentionTotal]);

  // Restore title/favicon/OS badge completely when the v2 shell unmounts.
  useEffect(() => () => resetAppBadge(), []);

  const signedIn = session.signedIn;

  /* When the app last went out of sight, or `null` when it is here or the
     absence has already been accounted for. A REF, not state: nothing renders
     from it, and it has to survive the socket effect re-running on a viewer
     change without being reset by it. */
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!signedIn || !userUuid) return;
    const echo = getV2Echo();
    if (!echo) return;

    const channelName = userChannelName(userUuid);
    const channel = echo.private(channelName);

    // Every signed-in v2 user, NO role gate (plan W1 item 2). Blanket
    // invalidation only: the broadcast/REST `type` strings are two different
    // vocabularies (digest §F.8), so nothing here may branch on the payload.
    //
    // THE INVITATION INBOXES GO STALE ON THE SAME EVENT (W4 report, W5): three
    // of the four notification types ARE invitations, and an invitation is the
    // one collab arrival with no other live signal — it comes from someone
    // else, and no `.channel.unread` or room event accompanies it. Without
    // this the pending badge on `/spaces` waited for the next visit or window
    // focus. Blanket again, for the same reason: the payload's vocabulary is
    // not ours to branch on, and re-asking three cheap inboxes on a
    // notification is far below the cost of a badge that lies.
    channel.notification(() => {
      void queryClient.invalidateQueries({
        queryKey: notificationsQueries.all,
      });
      void queryClient.invalidateQueries({
        queryKey: invitationsQueries.all,
      });
    });

    channel.listen(EVT_CHANNEL_UNREAD, (payload: ChannelUnreadEvent) => {
      handleChannelUnread(queryClient, payload, viewerId, (href) =>
        router.push(href),
      );
    });

    // Reconnect gap recovery: between drop and re-establish, every event was
    // lost for good — mark all collab-fed surfaces stale so active consumers
    // refetch through the normal auth path (invalidate-on-event default).
    let hasConnected = false;
    const unsubscribe = echo.connector.onConnectionChange((status) => {
      if (status !== 'connected') return;
      if (hasConnected) invalidateCollabSurfaces(queryClient);
      hasConnected = true;
    });

    return () => {
      unsubscribe();
      echo.leave(channelName);
      // Viewer change or v2 unmount: the connection is viewer-authorized
      // state, torn down on the same edge the cache-identity guard clears.
      disconnectV2Echo();
    };
  }, [signedIn, userUuid, viewerId, queryClient, router]);

  /* ── RETURN-FROM-BACKGROUND CATCH-UP ────────────────────────────────────────
        The reconnect recovery above is the right mechanism on the wrong
        trigger. It waits for pusher-js to NOTICE the socket died: Reverb
        advertises a 30s activity timeout and the client then allows 30s for the
        pong, and a backgrounded tab has its timers frozen, so most of that clock
        is paid AFTER the reader comes back. Meanwhile the transcript is
        `STALE_TIMES.realtime`, so returning refetches the channel row, the
        roster and the space rollups (all standard tier) but never the messages.
        That is the reported bug exactly: an open channel screen, backgrounded,
        a message arrives, and the reader watches an old screen for up to a
        minute.

        So the return itself is the trigger. `focusManager` and not a bespoke
        `document.addEventListener`, because it is the same signal TanStack's own
        refetch runs on: one source of truth for "the app is here", already
        wired, already the thing tests fake. Its listener fires on both edges and
        never on subscribe, which is why the hidden stamp is taken in the
        callback rather than at subscribe time.

        A SHORT ABSENCE ASKS FOR NOTHING (`BACKGROUND_GAP_MS`): the socket rides
        those out and its events already did the work.

        NO SOCKET KICK, DELIBERATELY. `connectionStatus()` reports `connected`
        for a zombie, so gating on it would skip the exact case this exists for;
        and there is no public way to force a reconnect short of
        disconnect-then-connect, which would bounce a healthy connection and
        blink this reader out of everyone else's presence faces. The socket is
        left to heal on its own clock while the data catches up on ours. */
  useEffect(() => {
    if (!signedIn) return;
    return focusManager.subscribe((focused) => {
      if (!focused) {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt === null || Date.now() - hiddenAt < BACKGROUND_GAP_MS) return;
      invalidateCollabSurfaces(queryClient);
    });
  }, [signedIn, queryClient]);

  return null;
}
