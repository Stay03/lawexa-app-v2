'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { messagesApi } from '@/lib/api/collab';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  Message,
  MessageListResponse,
  SendMessageResponse,
  SlimUser,
} from '@/types/collab';
import { applyMessageCreated } from './cache';
import { LOCAL_MESSAGE_PREFIX } from './model';
import { channelsQueries } from './queries';
import {
  outboxMarkFailed,
  outboxMarkSending,
  outboxRemove,
  outboxSet,
} from './send-outbox';

/**
 * message-mutations — send / edit / delete for the W2 channel feed. Ported
 * from v1 `useCollab.ts` onto the v2 keys (never imported — boundary rule),
 * with the ONE deliberate behavioural change the study demands (A4 FIX):
 * a failed send is NEVER rolled back. v1 removed the optimistic bubble and
 * re-filled the composer; §5's ladder keeps the row inline as `failed` with
 * Retry — the outbox (`./send-outbox.ts`) carries that state, the cache keeps
 * the row. Sources: plan W2 item 4, foundation-standards §5, api-digest §C
 * (60/min send throttle, `reply_to_uuid` same-channel rule) — 2026-08-04.
 *
 * ERROR CHANNEL: every mutation here is `silentError` — failures surface
 * INLINE (the failed row, the edit row's error line, a delete's rollback), so
 * the screen raises no toasts (W2 house rule; design-research DIRECTION 6).
 */

type MessagePages = InfiniteData<MessageListResponse, string | null>;

let localCounter = 0;

/** The acting user as a SlimUser, read from the sanctioned token bridge at
 *  MUTATION time (never in render — a store selector building an object
 *  would loop via useSyncExternalStore). */
function actingUser(): SlimUser | null {
  const me = useAuthStore.getState().user;
  return me
    ? { uuid: me.uuid ?? '', name: me.name, avatar_url: me.avatar_url }
    : null;
}

/** Insert an optimistic row at the head of the newest page of every cached
 *  history variant (pages are newest-first). */
function insertLocalMessage(
  queryClient: QueryClient,
  channelUuid: string,
  message: Message,
): void {
  queryClient.setQueriesData<MessagePages>(
    { queryKey: channelsQueries.messagesOf(channelUuid) },
    (data) => {
      if (!data || data.pages.length === 0) return data;
      const [first, ...rest] = data.pages;
      return {
        ...data,
        pages: [{ ...first, data: [message, ...first.data] }, ...rest],
      };
    },
  );
}

/** Drop a message (by uuid) from every cached history variant. */
function dropMessage(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string,
): void {
  queryClient.setQueriesData<MessagePages>(
    { queryKey: channelsQueries.messagesOf(channelUuid) },
    (data) => {
      if (!data) return data;
      let changed = false;
      const pages = data.pages.map((page) => {
        const rows = page.data.filter((row) => row.uuid !== messageUuid);
        if (rows.length === page.data.length) return page;
        changed = true;
        return { ...page, data: rows };
      });
      return changed ? { ...data, pages } : data;
    },
  );
}

/** Replace a message wherever it is cached (same-reference no-op). */
function replaceMessage(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string,
  next: Message,
): void {
  queryClient.setQueriesData<MessagePages>(
    { queryKey: channelsQueries.messagesOf(channelUuid) },
    (data) => {
      if (!data) return data;
      let changed = false;
      const pages = data.pages.map((page) => {
        let pageChanged = false;
        const rows = page.data.map((row) => {
          if (row.uuid !== messageUuid) return row;
          pageChanged = true;
          return next;
        });
        if (!pageChanged) return page;
        changed = true;
        return { ...page, data: rows };
      });
      return changed ? { ...data, pages } : data;
    },
  );
}

export interface SendMessageVariables {
  content: string;
  /** Reply target — becomes `reply_to_uuid` on the wire (3b). */
  replyToUuid?: string | null;
  /** The quoted context for the OPTIMISTIC row, so a reply renders its quote
   *  before the server echoes it back. Derived by the composer from the
   *  target message it is replying to. */
  replyToPreview?: Message['reply_to'];
  /** A RETRY re-uses the failed row instead of inserting a second one —
   *  the uuid stays stable, so the row never re-animates. */
  retryLocalUuid?: string;
}

/**
 * Optimistic send. The `data.ai` dispatch block (present only when `@lawexa`
 * was mentioned) is passed through to the caller's `onSuccess` — the composer
 * surfaces a blocked summon INLINE to the summoner (nothing posts for others;
 * digest §F.12). It is stripped before the row enters the cache.
 */
export function useSendChannelMessage(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, Error, SendMessageVariables, { localUuid: string }>({
    mutationFn: ({ content, replyToUuid }) =>
      messagesApi.send(channelUuid, {
        content,
        ...(replyToUuid ? { reply_to_uuid: replyToUuid } : {}),
      }),
    meta: { silentError: true },

    onMutate: ({ content, replyToUuid, replyToPreview, retryLocalUuid }) => {
      if (retryLocalUuid) {
        outboxMarkSending(retryLocalUuid);
        return { localUuid: retryLocalUuid };
      }
      const localUuid = `${LOCAL_MESSAGE_PREFIX}${(localCounter += 1)}`;
      const optimistic: Message = {
        uuid: localUuid,
        channel_uuid: channelUuid,
        is_ai: false,
        author: actingUser(),
        content,
        metadata: {
          mentions: [],
          lawexa_mentioned: /(^|\s)@lawexa\b/i.test(content),
        },
        parent_message_uuid: replyToUuid ?? null,
        reply_to: replyToPreview ?? null,
        edited_at: null,
        created_at: new Date().toISOString(),
      };
      insertLocalMessage(queryClient, channelUuid, optimistic);
      outboxSet(localUuid, {
        status: 'sending',
        content,
        replyToUuid: replyToUuid ?? null,
        channelUuid,
        message: optimistic,
      });
      return { localUuid };
    },

    onError: (_error, _variables, context) => {
      // NO rollback — the ladder's whole point. The row stays, flagged failed.
      if (context) outboxMarkFailed(context.localUuid);
    },

    onSuccess: (response, _variables, context) => {
      // The `ai` block is a send-time signal, not history — strip it so the
      // cache holds a clean Message (v1's rule, kept).
      const { ai: _ai, ...server } = response.data;
      void _ai;
      if (context) {
        // Drop the local row first, THEN dedupe-insert the server row: if the
        // presence broadcast already delivered it, the writer's uuid dedupe
        // makes this a no-op instead of a duplicate key.
        dropMessage(queryClient, channelUuid, context.localUuid);
        outboxRemove(context.localUuid);
      }
      applyMessageCreated(queryClient, server);
    },
  });
}

/** Discard a failed optimistic row (the user chose not to retry). Stable
 *  identity — the feed folds it into its memoised row-actions object. */
export function useDiscardFailedMessage(channelUuid: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (localUuid: string) => {
      dropMessage(queryClient, channelUuid, localUuid);
      outboxRemove(localUuid);
    },
    [queryClient, channelUuid],
  );
}

export interface EditMessageVariables {
  messageUuid: string;
  content: string;
}

/** Edit an authored message; content + `edited_at` update optimistically and
 *  reconcile with the server row (mentions are re-parsed server-side). */
export function useEditChannelMessage(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof messagesApi.update>>,
    Error,
    EditMessageVariables,
    { previous: Message | null }
  >({
    mutationFn: ({ messageUuid, content }) =>
      messagesApi.update(channelUuid, messageUuid, { content }),
    meta: { silentError: true },

    onMutate: ({ messageUuid, content }) => {
      let previous: Message | null = null;
      for (const [, data] of queryClient.getQueriesData<MessagePages>({
        queryKey: channelsQueries.messagesOf(channelUuid),
      })) {
        const row = data?.pages
          .flatMap((page) => page.data)
          .find((candidate) => candidate.uuid === messageUuid);
        if (row) {
          previous = row;
          break;
        }
      }
      if (previous) {
        replaceMessage(queryClient, channelUuid, messageUuid, {
          ...previous,
          content,
          edited_at: new Date().toISOString(),
        });
      }
      return { previous };
    },

    onError: (_error, { messageUuid }, context) => {
      if (context?.previous) {
        replaceMessage(queryClient, channelUuid, messageUuid, context.previous);
      }
    },

    onSuccess: (response) => {
      replaceMessage(queryClient, channelUuid, response.data.uuid, response.data);
    },
  });
}

/** Soft-delete a message; it drops immediately and rolls back on failure
 *  (the returning row IS the inline failure surface — no toast). */
export function useDeleteChannelMessage(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof messagesApi.remove>>,
    Error,
    string,
    { snapshots: [readonly unknown[], MessagePages | undefined][] }
  >({
    mutationFn: (messageUuid) => messagesApi.remove(channelUuid, messageUuid),
    meta: { silentError: true },

    onMutate: (messageUuid) => {
      const snapshots = queryClient.getQueriesData<MessagePages>({
        queryKey: channelsQueries.messagesOf(channelUuid),
      });
      dropMessage(queryClient, channelUuid, messageUuid);
      return { snapshots: [...snapshots] };
    },

    onError: (_error, _messageUuid, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        if (data) queryClient.setQueryData(queryKey, data);
      }
    },
  });
}
