'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelsApi } from '@/lib/api/collab';
import { applySpaceRollupDeltas } from '@/v2/features/spaces/cache';
import {
  registerActiveChannel,
  unregisterActiveChannel,
} from '@/v2/runtime/realtime/active-channel';
import { applyChannelCounts } from './cache';

/**
 * useChannelReadPointer — the HEADLESS mark-read triggers of foundation-
 * standards §5, exactly as written (plan W1 item 6, 2026-08-04):
 *
 *   channel open AND document visible AND newest message in viewport ≥1s
 *   → POST read; or the user sends; or clicks the jump-to-latest pill.
 *   Opening unfocused does NOT mark read.
 *
 * WHAT SHIPS NOW vs THE W2 SEAM. "Channel open" and "document visible" are
 * fully implemented here: mounting this hook (enabled) IS the open signal —
 * it also registers the channel into the active-channel store, so the
 * dispatcher's never-notify-the-visible-conversation rule and this hook agree
 * on one definition of "open" by construction. The VIEWPORT clause is the
 * documented seam: the W2 feed observes its newest row (IntersectionObserver)
 * and reports through {@link ChannelReadReporter.reportNewestVisible} — until
 * it does, no dwell timer ever arms, so nothing is marked prematurely.
 *
 * THE DWELL CONTRACT: a report arms a 1s timer only while the document is
 * visible; hiding the document (or the newest row leaving the viewport —
 * reported as `null`) cancels it; becoming visible again re-arms it for the
 * still-pending newest message. So a channel opened in a background tab marks
 * nothing until the user actually looks at it for a second — the §5 sentence,
 * mechanised.
 *
 * SELF-HEALING BY DESIGN, THREE LAYERS DEEP:
 *  1. the response's `unread_count` is assigned locally (writers) so the row
 *     un-bolds without waiting on anything;
 *  2. the server echoes `.channel.unread` to ALL the user's devices (digest
 *     §D trigger 2) — including this one, where the assignment is then a
 *     reference-stable no-op;
 *  3. the POST is `silentError` + fire-and-forget: a failed mark is invisible
 *     (the next trigger retries), never a toast — reading is not an action
 *     the user performed.
 *
 * The markRead 422 copy is deliberately uniform server-side (anti-oracle,
 * digest §F.5) — nothing here reads error text. Esc-to-mark-read is a W2
 * screen affordance that will call {@link ChannelReadReporter.markReadNow}.
 */

const NEWEST_VISIBLE_DWELL_MS = 1000;

export interface ChannelReadReporter {
  /**
   * W2 feed seam: the newest message's uuid while it is inside the viewport,
   * `null` the moment it leaves. Idempotent per uuid — re-reporting an
   * already-marked message never re-POSTs.
   */
  reportNewestVisible: (messageUuid: string | null) => void;
  /** Immediate mark — the send trigger and the jump-to-latest-pill click. */
  markReadNow: (messageUuid: string) => void;
}

export function useChannelReadPointer(
  channelUuid: string,
  options: { enabled?: boolean } = {},
): ChannelReadReporter {
  const enabled = (options.enabled ?? true) && !!channelUuid;
  const queryClient = useQueryClient();

  /** The newest-visible candidate the feed last reported (null = none). */
  const candidateRef = useRef<string | null>(null);
  /** The last uuid actually POSTed — the client-side idempotence guard. */
  const lastMarkedRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const { mutate } = useMutation({
    mutationFn: (messageUuid: string) =>
      channelsApi.markRead(channelUuid, messageUuid),
    // Serialize marks per channel so an out-of-order pair can't land reversed
    // (the server is monotonic anyway; this keeps the local writes ordered too).
    scope: { id: `channel-read-${channelUuid}` },
    meta: { silentError: true },
    onSuccess: (response) => {
      // Assign the authoritative unread count; mention_count rides along only
      // when it is provably zero (the writer's subset rule) — the event echo
      // reconciles any partial-read remainder.
      const application = applyChannelCounts(queryClient, channelUuid, {
        unreadCount: response.data.unread_count,
        mentionCount: null,
      });
      if (application.deltas && application.spaceUuid) {
        applySpaceRollupDeltas(
          queryClient,
          application.spaceUuid,
          application.deltas,
        );
      }
    },
  });

  const fire = useCallback(
    (messageUuid: string) => {
      if (lastMarkedRef.current === messageUuid) return;
      lastMarkedRef.current = messageUuid;
      mutate(messageUuid);
    },
    [mutate],
  );

  const armDwellTimer = useCallback(
    (messageUuid: string) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        // Re-verify at expiry: the candidate may have changed and the tab may
        // have been hidden since arming — both cancel the mark.
        if (candidateRef.current !== messageUuid) return;
        if (document.visibilityState !== 'visible') return;
        fire(messageUuid);
      }, NEWEST_VISIBLE_DWELL_MS);
    },
    [clearTimer, fire],
  );

  const reportNewestVisible = useCallback(
    (messageUuid: string | null) => {
      candidateRef.current = messageUuid;
      clearTimer();
      if (!enabled || !messageUuid) return;
      if (lastMarkedRef.current === messageUuid) return;
      // Opening (or sitting) unfocused does NOT mark read — the visibility
      // listener below re-arms when the document becomes visible.
      if (document.visibilityState !== 'visible') return;
      armDwellTimer(messageUuid);
    },
    [enabled, clearTimer, armDwellTimer],
  );

  const markReadNow = useCallback(
    (messageUuid: string) => {
      if (!enabled || !messageUuid) return;
      clearTimer();
      fire(messageUuid);
    },
    [enabled, clearTimer, fire],
  );

  // "Channel open" — one registration point shared with the dispatcher's
  // visible-conversation suppression, so the two can never disagree.
  useEffect(() => {
    if (!enabled) return;
    registerActiveChannel(channelUuid);
    return () => unregisterActiveChannel(channelUuid);
  }, [enabled, channelUuid]);

  // Visibility half of the trigger: hide cancels the dwell; show re-arms it
  // for the still-pending newest message.
  useEffect(() => {
    if (!enabled) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const candidate = candidateRef.current;
        if (candidate && candidate !== lastMarkedRef.current) {
          armDwellTimer(candidate);
        }
      } else {
        clearTimer();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimer();
    };
  }, [enabled, armDwellTimer, clearTimer]);

  // A different channel is a fresh pointer conversation — drop carried state.
  useEffect(() => {
    candidateRef.current = null;
    lastMarkedRef.current = null;
    return clearTimer;
  }, [channelUuid, clearTimer]);

  return useMemo(
    () => ({ reportNewestVisible, markReadNow }),
    [reportNewestVisible, markReadNow],
  );
}
