'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  applyChannelCounts,
  type ChannelCountsApplication,
} from '@/v2/features/channels/cache';
import { channelsQueries } from '@/v2/features/channels/queries';
import { collabAccessState } from '@/v2/features/collab/model';
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
 *  - reconnect gap recovery — events are fire-and-forget (digest §F.11), so a
 *    re-established connection marks every collab surface stale;
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
      channelName: response.data.name ?? application.channelName,
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

  // 3. Toast/sound — mentions only, so the (possibly fetching) resolution is
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
  // the home's "Jump back in" key, warm before the user ever visits it).
  useQuery({ ...channelsQueries.mine({}), enabled: eligible });

  const mentionTotal = eligible ? (badgeQuery.data ?? 0) : 0;

  useEffect(() => {
    setAppMentionBadge(mentionTotal);
  }, [mentionTotal]);

  // Restore title/favicon/OS badge completely when the v2 shell unmounts.
  useEffect(() => () => resetAppBadge(), []);

  const signedIn = session.signedIn;

  useEffect(() => {
    if (!signedIn || !userUuid) return;
    const echo = getV2Echo();
    if (!echo) return;

    const channelName = userChannelName(userUuid);
    const channel = echo.private(channelName);

    // Every signed-in v2 user, NO role gate (plan W1 item 2). Blanket
    // invalidation only: the broadcast/REST `type` strings are two different
    // vocabularies (digest §F.8), so nothing here may branch on the payload.
    channel.notification(() => {
      void queryClient.invalidateQueries({
        queryKey: notificationsQueries.all,
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
      if (hasConnected) {
        void queryClient.invalidateQueries({ queryKey: spacesQueries.all });
        void queryClient.invalidateQueries({ queryKey: channelsQueries.all });
        void queryClient.invalidateQueries({
          queryKey: notificationsQueries.all,
        });
      }
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

  return null;
}
