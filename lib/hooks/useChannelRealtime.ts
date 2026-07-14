'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { getEcho } from '@/lib/realtime/echo';
import {
  addFileCache,
  collabKeys,
  removeFileCache,
  removeListCaches,
  upsertListCaches,
  useCurrentUserUuid,
} from '@/lib/hooks/useCollab';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  ChannelFile,
  Message,
  MessageListResponse,
  SlimUser,
  TaskList,
} from '@/types/collab';

const TYPING_TTL_MS = 3000;
const TYPING_THROTTLE_MS = 2000;
const LAWEXA_TURN_TTL_MS = 120_000;

type MessagePages = InfiniteData<MessageListResponse>;

/** Insert an incoming message at the head of the newest page, de-duplicated. */
function prependMessage(
  queryClient: QueryClient,
  channelUuid: string,
  message: Message
) {
  const key = collabKeys.channels.messagesPrefix(channelUuid);
  const queries = queryClient.getQueriesData<MessagePages>({ queryKey: key });
  for (const [qKey, data] of queries) {
    if (!data || data.pages.length === 0) continue;
    const exists = data.pages.some((page) =>
      page.data.some((m) => m.uuid === message.uuid)
    );
    if (exists) continue;
    const [first, ...rest] = data.pages;
    queryClient.setQueryData<MessagePages>(qKey, {
      ...data,
      pages: [{ ...first, data: [message, ...first.data] }, ...rest],
    });
  }
}

function replaceMessage(
  queryClient: QueryClient,
  channelUuid: string,
  message: Message
) {
  const key = collabKeys.channels.messagesPrefix(channelUuid);
  const queries = queryClient.getQueriesData<MessagePages>({ queryKey: key });
  for (const [qKey, data] of queries) {
    if (!data) continue;
    queryClient.setQueryData<MessagePages>(qKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.map((m) => (m.uuid === message.uuid ? message : m)),
      })),
    });
  }
}

function removeMessage(
  queryClient: QueryClient,
  channelUuid: string,
  messageUuid: string
) {
  const key = collabKeys.channels.messagesPrefix(channelUuid);
  const queries = queryClient.getQueriesData<MessagePages>({ queryKey: key });
  for (const [qKey, data] of queries) {
    if (!data) continue;
    queryClient.setQueryData<MessagePages>(qKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.filter((m) => m.uuid !== messageUuid),
      })),
    });
  }
}

export interface TypingUser {
  uuid: string;
  name: string;
}

export interface LawexaTurn {
  executionId: string;
  summoner: SlimUser;
  /** UUID of the channel message that mentioned @lawexa and started this turn.
   *  Anchors the inline responding row + peek under that message. Empty string
   *  when the backend hasn't attached it yet — the turn simply won't anchor. */
  messageUuid: string;
}

export interface ChannelRealtime {
  connected: boolean;
  onlineUuids: Set<string>;
  onlineCount: number;
  typingUsers: TypingUser[];
  /** Active Lawexa summons in this channel — each drives an inline "responding"
   *  row anchored under its triggering message (keyed by `messageUuid`). */
  lawexaTurns: LawexaTurn[];
  /** Throttled typing whisper for the composer to call on keystroke. */
  notifyTyping: () => void;
}

/**
 * Subscribe to a channel's presence room: live message create/update/delete
 * into the query cache, membership + presence tracking, typing whispers, and
 * reconnect gap-recovery. Self-eviction (`member.left` for you) leaves the
 * socket and forces the channel detail to refetch (→ access-denied state).
 */
export function useChannelRealtime(
  channelUuid: string,
  options: { enabled?: boolean } = {}
): ChannelRealtime {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const myUuid = useCurrentUserUuid();
  const myName = useAuthStore((s) => s.user?.name ?? '');

  const [connected, setConnected] = useState(false);
  const [onlineUuids, setOnlineUuids] = useState<Set<string>>(() => new Set());
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [lawexaTurns, setLawexaTurns] = useState<LawexaTurn[]>([]);

  const whisperRef = useRef<((event: string, data: unknown) => void) | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const turnTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastWhisperAt = useRef(0);

  useEffect(() => {
    if (!enabled || !channelUuid) return;
    const echo = getEcho();
    if (!echo) return;

    const name = `channels.${channelUuid}`;
    const channel = echo.join(name);
    whisperRef.current = (event, data) => channel.whisper(event, data as Record<string, unknown>);
    const timers = typingTimers.current;
    const aiTimers = turnTimers.current;

    channel
      .here((members: SlimUser[]) =>
        setOnlineUuids(new Set(members.map((m) => m.uuid)))
      )
      .joining((member: SlimUser) =>
        setOnlineUuids((prev) => new Set(prev).add(member.uuid))
      )
      .leaving((member: SlimUser) =>
        setOnlineUuids((prev) => {
          const next = new Set(prev);
          next.delete(member.uuid);
          return next;
        })
      );

    channel.listen('.message.created', (payload: Message) => {
      prependMessage(queryClient, channelUuid, payload);
      // A Lawexa REPLY (not a session divider) resolves a turn. Messages carry
      // no execution_id, so we clear the OLDEST active turn — the documented
      // heuristic. The turn's backstop timer stays armed but no-ops on expiry
      // since it filters by its own captured executionId (keeps updaters pure).
      if (payload.is_ai && payload.metadata?.type !== 'ai_divider') {
        setLawexaTurns((prev) => (prev.length ? prev.slice(1) : prev));
      }
    });
    channel.listen('.message.updated', (payload: Message) =>
      replaceMessage(queryClient, channelUuid, payload)
    );
    channel.listen('.message.deleted', (payload: { uuid: string }) =>
      removeMessage(queryClient, channelUuid, payload.uuid)
    );

    channel.listen(
      '.ai.turn_started',
      (payload: {
        channel_uuid: string;
        execution_id: string;
        summoner: SlimUser;
        message_uuid?: string;
      }) => {
        if (!payload.execution_id) return;
        const executionId = payload.execution_id;
        const messageUuid = payload.message_uuid ?? '';
        setLawexaTurns((prev) =>
          prev.some((t) => t.executionId === executionId)
            ? prev
            : [...prev, { executionId, summoner: payload.summoner, messageUuid }]
        );
        // Backstop: drop the turn if no reply/failure arrives in time.
        const existing = aiTimers.get(executionId);
        if (existing) clearTimeout(existing);
        aiTimers.set(
          executionId,
          setTimeout(() => {
            setLawexaTurns((prev) =>
              prev.filter((t) => t.executionId !== executionId)
            );
            aiTimers.delete(executionId);
          }, LAWEXA_TURN_TTL_MS)
        );
      }
    );
    channel.listen(
      '.ai.turn_failed',
      (payload: { channel_uuid: string; execution_id: string }) => {
        if (!payload.execution_id) return;
        const executionId = payload.execution_id;
        setLawexaTurns((prev) =>
          prev.filter((t) => t.executionId !== executionId)
        );
        const existing = aiTimers.get(executionId);
        if (existing) clearTimeout(existing);
        aiTimers.delete(executionId);
      }
    );

    // Task lists & files ride this same presence room. `.list.changed` carries
    // the full list snapshot (WITH items); reconcile the detail + derived index
    // through the shared cache-writers so the two list shapes never drift.
    channel.listen(
      '.list.changed',
      (payload: {
        action: 'created' | 'updated' | 'deleted' | 'item_changed';
        list: TaskList;
      }) => {
        if (payload.action === 'deleted') {
          removeListCaches(queryClient, channelUuid, payload.list.uuid);
        } else {
          upsertListCaches(queryClient, channelUuid, payload.list);
        }
      }
    );
    channel.listen(
      '.file.changed',
      (payload: { action: 'added' | 'removed'; file: ChannelFile }) => {
        if (payload.action === 'removed') {
          removeFileCache(queryClient, channelUuid, payload.file.id);
        } else {
          addFileCache(queryClient, channelUuid, payload.file);
        }
      }
    );

    channel.listen('.member.joined', () => {
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.detail(channelUuid),
      });
      queryClient.invalidateQueries({
        queryKey: ['collab', 'channels', channelUuid, 'members'],
      });
    });
    channel.listen('.member.left', (payload: { member?: SlimUser }) => {
      // Self-eviction: stop listening and let the channel detail refetch fail
      // into the access-denied view. (Server-side revocation is the real fix.)
      if (payload.member?.uuid && myUuid && payload.member.uuid === myUuid) {
        echo.leave(name);
      }
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.detail(channelUuid),
      });
      queryClient.invalidateQueries({
        queryKey: ['collab', 'channels', channelUuid, 'members'],
      });
    });

    channel.listenForWhisper('typing', (payload: TypingUser) => {
      if (!payload?.uuid || payload.uuid === myUuid) return;
      setTypingUsers((prev) => [
        ...prev.filter((u) => u.uuid !== payload.uuid),
        { uuid: payload.uuid, name: payload.name },
      ]);
      const existing = timers.get(payload.uuid);
      if (existing) clearTimeout(existing);
      timers.set(
        payload.uuid,
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.uuid !== payload.uuid));
          timers.delete(payload.uuid);
        }, TYPING_TTL_MS)
      );
    });

    let hasConnected = false;
    const unsubscribe = echo.connector.onConnectionChange((status: string) => {
      const isConnected = status === 'connected';
      setConnected(isConnected);
      if (isConnected) {
        // A reconnect can have gaps — refetch history to reconcile.
        if (hasConnected) {
          queryClient.invalidateQueries({
            queryKey: collabKeys.channels.messagesPrefix(channelUuid),
          });
        }
        hasConnected = true;
      }
    });

    return () => {
      unsubscribe();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const t of aiTimers.values()) clearTimeout(t);
      aiTimers.clear();
      whisperRef.current = null;
      echo.leave(name);
      setOnlineUuids(new Set());
      setTypingUsers([]);
      setLawexaTurns([]);
      setConnected(false);
    };
  }, [enabled, channelUuid, queryClient, myUuid]);

  const notifyTyping = useCallback(() => {
    const whisper = whisperRef.current;
    if (!whisper || !myUuid) return;
    const now = Date.now();
    if (now - lastWhisperAt.current < TYPING_THROTTLE_MS) return;
    lastWhisperAt.current = now;
    whisper('typing', { uuid: myUuid, name: myName });
  }, [myUuid, myName]);

  return {
    connected,
    onlineUuids,
    onlineCount: onlineUuids.size,
    typingUsers,
    lawexaTurns,
    notifyTyping,
  };
}
