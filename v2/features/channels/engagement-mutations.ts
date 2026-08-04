'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { messageEngagementApi } from '@/lib/api/collab';
import type { Message } from '@/types/collab';
import {
  applyBookmarkState,
  applyPinState,
  applyReactionToggled,
  findCachedMessage,
  removeFromMessageCollection,
  restoreMessageCollections,
  type CollectionSnapshot,
} from './cache';
import { noteThrottled } from './engagement-throttle';
import { channelsQueries } from './queries';

/**
 * engagement-mutations — the three W3 toggles: react, pin, save. Phase-5 W3;
 * sources: plan W3 items 1–3, `api-digest.md` §C (endpoints + the 60/min
 * ceilings) and §F.2/§F.18 (per-viewer transport, change-only broadcasts),
 * study A4's three BUILD NEW verdicts — 2026-08-04.
 *
 * ONE SHAPE FOR ALL THREE. Every toggle is optimistic-write → server-settle →
 * rollback-on-failure, because all three are instantaneous, reversible, and
 * socially cheap: waiting for a round trip to colour a chip would be felt, and
 * a wrong guess costs one repaint. The optimistic value is written through the
 * SAME cache writers the realtime room uses, so a local toggle and a stranger's
 * broadcast converge on identical state.
 *
 * FAILURE IS SILENT BY DESIGN (`meta.silentError`, the W2 house rule for this
 * screen). Two reasons, and they are different:
 *  - a 429 is not an error at all — the reader is simply going faster than the
 *    ceiling, so the action family goes quiet for a beat
 *    (`./engagement-throttle.ts`) and the chip rolls back. Reactions never
 *    notify ANYONE (design-research DIRECTION 5); making the reactor the one
 *    person the feature interrupts would be exactly backwards.
 *  - anything else (a lost socket, a deleted target's 422) rolls back too. The
 *    restored chip IS the message: the state you see is the state that exists.
 *
 * PINS AND SAVES DIVERGE ON WHO ELSE FINDS OUT. A pin is shared — the server
 * broadcasts `.message.pinned`, every other member's feed updates, and this
 * mutation additionally invalidates the pins PANEL (the event carries no
 * message body, so the panel cannot be hand-patched). A save is private and has
 * no event whatsoever: this mutation is its entire transport, and the saved
 * panel is invalidated for the same reason.
 *
 * THE ROLLBACK WINDOW, STATED PLAINLY (audit L1). A rollback restores the value
 * captured in `onMutate`, so a stranger's `.reaction.toggled` (or a
 * `.message.pinned`) that lands between the optimistic write and a FAILED
 * response is discarded along with the failed guess — for the few hundred
 * milliseconds of that round trip, one emoji bucket can hold a stale count.
 * This is accepted rather than defended against, because every mechanism that
 * would fix it costs more than the fault: the events are absolute-state
 * deltas, so the NEXT one on that message corrects it, a reload corrects it,
 * and the reader's own next toggle corrects it. Reconciling mid-flight would
 * mean tracking per-emoji sequence numbers the backend does not send.
 */

export interface ToggleReactionVariables {
  messageUuid: string;
  /** The exact emoji string the picker produced — grapheme-strict server-side
   *  (§F.9), so it is passed through untouched, never normalised. */
  emoji: string;
}

/**
 * Toggle one emoji on one message.
 *
 * The optimistic delta is derived from the CACHED row, so a bucket the viewer
 * already holds decrements (and disappears at zero) while a new one appends at
 * `count: 1`. The server's answer is absolute and overwrites it — including the
 * case where a stranger's reaction landed between the click and the response.
 */
export function useToggleReaction(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof messageEngagementApi.toggleReaction>>,
    Error,
    ToggleReactionVariables,
    { previous: Message | null }
  >({
    mutationFn: ({ messageUuid, emoji }) =>
      messageEngagementApi.toggleReaction(channelUuid, messageUuid, { emoji }),
    meta: { silentError: true },

    onMutate: ({ messageUuid, emoji }) => {
      const previous = findCachedMessage(queryClient, channelUuid, messageUuid);
      const bucket = previous?.reactions?.find((entry) => entry.emoji === emoji);
      const mine = bucket?.reacted_by_me ?? false;
      applyReactionToggled(queryClient, channelUuid, {
        messageUuid,
        emoji,
        count: (bucket?.count ?? 0) + (mine ? -1 : 1),
        reactedByMe: !mine,
      });
      return { previous };
    },

    onError: (error, { messageUuid, emoji }, context) => {
      noteThrottled('reaction', error);
      const bucket = context?.previous?.reactions?.find(
        (entry) => entry.emoji === emoji,
      );
      applyReactionToggled(queryClient, channelUuid, {
        messageUuid,
        emoji,
        count: bucket?.count ?? 0,
        reactedByMe: bucket?.reacted_by_me ?? false,
      });
    },

    onSuccess: (response, { messageUuid }) => {
      applyReactionToggled(queryClient, channelUuid, {
        messageUuid,
        emoji: response.data.emoji,
        count: response.data.count,
        reactedByMe: response.data.reacted_by_me,
      });
    },
  });
}

export interface TogglePinVariables {
  messageUuid: string;
  /** The state to move TO. Any active member may pin AND unpin anyone's pin
   *  (api-digest §C) — there is no ownership check to make here. */
  pinned: boolean;
}

/**
 * Pin / unpin a message for the whole channel.
 *
 * UNPINNING also removes the row from the pins PANEL immediately, because that
 * is usually where the click came from and a row that lingers until a refetch
 * lands reads as a dead button. Pinning does not add a row: `pinned_by` and
 * `pinned_at` are the server's to say, and a half-built row is worse than a
 * row that appears a moment later.
 */
export function useTogglePin(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof messageEngagementApi.pin>>,
    Error,
    TogglePinVariables,
    { previous: boolean; collections: CollectionSnapshot[] }
  >({
    mutationFn: ({ messageUuid, pinned }) =>
      pinned
        ? messageEngagementApi.pin(channelUuid, messageUuid)
        : messageEngagementApi.unpin(channelUuid, messageUuid),
    meta: { silentError: true },

    onMutate: ({ messageUuid, pinned }) => {
      const previous =
        findCachedMessage(queryClient, channelUuid, messageUuid)?.is_pinned ?? false;
      applyPinState(queryClient, channelUuid, messageUuid, pinned);
      const collections = pinned
        ? []
        : removeFromMessageCollection(
            queryClient,
            channelsQueries.pinsOf(channelUuid),
            messageUuid,
          );
      return { previous, collections };
    },

    onError: (_error, { messageUuid }, context) => {
      applyPinState(queryClient, channelUuid, messageUuid, context?.previous ?? false);
      restoreMessageCollections(queryClient, context?.collections ?? []);
    },

    onSuccess: (response, { messageUuid }) => {
      applyPinState(queryClient, channelUuid, messageUuid, response.data.is_pinned);
    },

    // Whichever way it went, the PANEL's membership changed — and the event
    // that mirrors this to other members carries no message body, so a refetch
    // is the reconciliation that keeps that list right for everyone.
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.pinsOf(channelUuid),
      });
    },
  });
}

export interface ToggleSaveVariables {
  messageUuid: string;
  /** The state to move TO. */
  saved: boolean;
}

/**
 * Save / unsave a message privately.
 *
 * The endpoint is a pure toggle — it takes no desired state — so `saved` is the
 * caller's READING of the current state, used for the optimistic write and for
 * nothing else. The response's `bookmarked` is authoritative and settles it,
 * which also makes a double-click race self-correcting.
 */
export function useToggleSave(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof messageEngagementApi.toggleBookmark>>,
    Error,
    ToggleSaveVariables,
    { previous: boolean; collections: CollectionSnapshot[] }
  >({
    mutationFn: ({ messageUuid }) =>
      messageEngagementApi.toggleBookmark(channelUuid, messageUuid),
    meta: { silentError: true },

    onMutate: ({ messageUuid, saved }) => {
      const previous =
        findCachedMessage(queryClient, channelUuid, messageUuid)?.is_bookmarked ?? false;
      applyBookmarkState(queryClient, channelUuid, messageUuid, saved);
      // Un-saving from the saved panel removes the row now (same reasoning as
      // unpinning); saving does not insert one — the refetch places it.
      const collections = saved
        ? []
        : removeFromMessageCollection(
            queryClient,
            channelsQueries.savedOf(channelUuid),
            messageUuid,
          );
      return { previous, collections };
    },

    onError: (error, { messageUuid }, context) => {
      noteThrottled('bookmark', error);
      applyBookmarkState(
        queryClient,
        channelUuid,
        messageUuid,
        context?.previous ?? false,
      );
      restoreMessageCollections(queryClient, context?.collections ?? []);
    },

    onSuccess: (response, { messageUuid }) => {
      applyBookmarkState(
        queryClient,
        channelUuid,
        messageUuid,
        response.data.bookmarked,
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.savedOf(channelUuid),
      });
    },
  });
}
