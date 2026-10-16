'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { channelsApi } from '@/lib/api/collab';
import type {
  Channel,
  ChannelResponse,
  ThreadStatus,
  ThreadStatusValue,
} from '@/types/collab';
import {
  applyThreadStatus,
  applyThreadStub,
  findCachedThreadStatus,
  noteThreadStatusMoved,
} from '../cache';
import { threadStatusLabel } from '../thread-status-model';

/**
 * threads/mutations — starting a thread from a message (Phase 3, 2026-08-12).
 *
 * ── ONE VERB, AND IT SENDS NO TITLE ────────────────────────────────────────
 * Branching posts `{ root_message_uuid }` and nothing else: the server derives
 * the title from the root message's own first line, and a dialog asking a
 * reader to name a conversation before it exists is a form standing between a
 * thought and the room it belongs in. (The endpoint DOES take a title — it is
 * required for a STANDALONE thread, which has nothing to borrow words from —
 * and this app has no affordance for one.)
 *
 * ── 200 AND 201 ARE THE SAME OUTCOME, DELIBERATELY ─────────────────────────
 * The create is idempotent on the root: a message that already carries a live
 * thread comes back `200` with that thread's uuid instead of `201`. Both mean
 * "you are in the thread for this message", so nothing here tells them apart —
 * measured on prod 2026-08-12, same uuid, status 200, message "This message
 * already has a thread." It is nearly unreachable anyway: a message whose stub
 * this feed already holds never asks at all, it just navigates.
 *
 * ── WHAT IT WRITES, AND WHAT IT REFUSES TO GUESS ───────────────────────────
 * The stub goes under the root message immediately, so the door is standing
 * there on the frame the reader leaves — and on the frame they come back to,
 * from cache, before any refetch lands.
 *
 * `my_unread_count` is read off the response's OWN `is_member`, never assumed.
 * A `201` adds the creator as a follower, so `0` (following, caught up) is
 * true; the idempotent `200` adds NOBODY — it returns the existing thread
 * untouched — so a reader who has never posted there is still not following it,
 * and `null` is the honest answer. The channel resource carries no message
 * count at all, so that field is left to the cached stub (0 when there is none)
 * rather than published as a zero this response never said.
 *
 * THE ONE STALE CASE, STATED: a `200` landing on a page whose stub we do not
 * hold shows no count until the next history fetch. The room's join-time
 * reconcile invalidates the parent's message pages every time the reader
 * returns to it, so it heals on the way back — which is the only path from the
 * thread to that message anyway.
 */

export interface StartThreadVariables {
  /** The message being branched. It must be a SERVER uuid — an outbox row has
   *  no identity the server can resolve — which the feed's dispatcher enforces
   *  before this is ever called. */
  rootMessageUuid: string;
}

/**
 * Branch a message in `channelUuid` into a thread.
 *
 * NOT `meta.silentError`. The engagement toggles are silent because a failed
 * reaction rolls back and the restored chip IS the message; this one has
 * nothing to roll back and two refusals worth reading — the root was not found
 * in this channel (somebody deleted it between the render and the press), and
 * the one-level rule. The caller shows the server's own sentence under the
 * message it is about; this screen raises no toasts.
 */
export function useStartThread(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<ChannelResponse, Error, StartThreadVariables>({
    mutationFn: ({ rootMessageUuid }) =>
      channelsApi.createThread(channelUuid, {
        root_message_uuid: rootMessageUuid,
      }),

    onSuccess: (response, { rootMessageUuid }) => {
      const thread: Channel = response.data;
      applyThreadStub(queryClient, channelUuid, rootMessageUuid, {
        uuid: thread.uuid,
        // `title` is thread-only on the wire and never blank server-side, so
        // the fallback covers the field being absent, not empty — the same
        // `??` the display-name resolver makes.
        title: thread.title ?? thread.name,
        my_unread_count: thread.is_member === true ? 0 : null,
        last_message_at: thread.last_message_at,
      });
    },
  });
}

export interface SetThreadStatusVariables {
  /** The status to move to; `null` clears it. */
  status: ThreadStatusValue | null;
  /** Who is pressing, for the optimistic footer ("by Ada"). */
  viewer: { uuid: string; name: string } | null;
}

/**
 * Set or clear a thread's status (Stay, 16 October 2026: thread status).
 *
 * OPTIMISTIC, because the tick and the chip are the whole answer: every cached
 * copy of the thread (its detail, the list rows, the parent's Threads sheet)
 * moves on the press, through `applyThreadStatus`. A refusal puts back what
 * the cache held before and the caller shows the server's sentence inline,
 * where the press was; `meta.silentError` keeps the global toast out of it,
 * as on the engagement toggles. Success assigns the server's own status
 * object, which carries the real `changed_at`, `changed_by` and `is_stale`.
 *
 * Settling either way re-reads the parent's threads and detail, so a filtered
 * sheet re-files the row and the filter chips' counts move.
 *
 * The note is not sent: the first pass has no note field (Stay, 16 October
 * 2026). Leaving the key out keeps whatever the server holds.
 */
export function useSetThreadStatus(threadUuid: string, parentUuid: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    ChannelResponse,
    Error,
    SetThreadStatusVariables,
    { previous: ThreadStatus | null | undefined }
  >({
    mutationFn: ({ status }) => channelsApi.setStatus(threadUuid, { status }),
    meta: { silentError: true },

    onMutate: ({ status, viewer }) => {
      const previous = findCachedThreadStatus(queryClient, threadUuid);
      const optimistic: ThreadStatus | null =
        status === null
          ? null
          : {
              value: status,
              label: threadStatusLabel(status),
              note: null,
              changed_at: new Date().toISOString(),
              changed_by: viewer,
              via: 'app',
              is_stale: false,
            };
      applyThreadStatus(queryClient, threadUuid, optimistic);
      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context && context.previous !== undefined) {
        applyThreadStatus(queryClient, threadUuid, context.previous);
      }
    },

    onSuccess: (response) => {
      const status = response.data.status;
      if (status !== undefined) {
        applyThreadStatus(queryClient, threadUuid, status);
      }
    },

    onSettled: () => {
      noteThreadStatusMoved(queryClient, parentUuid);
    },
  });
}
