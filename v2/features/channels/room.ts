'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/authStore';
import type { ChannelFile, Message, SlimUser, TaskList } from '@/types/collab';
import { getV2Echo } from '@/v2/runtime/realtime/echo';
import { presenceChannelName } from '@/v2/runtime/realtime/protocol';
import {
  applyMessageCreated,
  applyMessageDeleted,
  applyMessageUpdated,
  noteChannelMembershipChanged,
} from './cache';
import {
  addFileCache,
  removeFileCache,
  removeListCaches,
  upsertListCaches,
} from './lists-files-cache';
import { channelsQueries } from './queries';

/**
 * useChannelRoom — the ONE presence-room subscription for an open channel
 * (`presence-channels.{uuid}`; Echo name from the spine's protocol module so
 * W1/W2 can never drift on the string). A port of v1's `useChannelRealtime`
 * onto the v2 writers (never imported — boundary rule; study A10 marks the
 * pattern KEEP-the-model). Sources: api-digest §B (events) / §F.1 (leading
 * dots) / §F.11 (fire-and-forget), plan W2 item 3 — 2026-08-04.
 *
 * N2 (W1 audit carry-forward): the subscription effect is KEYED ON THE VIEWER
 * (`myUuid`), exactly like the spine's — `disconnectV2Echo()` nulls the
 * singleton on the viewer edge, so this effect re-runs `getV2Echo()` and
 * re-joins on the new viewer's socket instead of holding a dead reference.
 * The room only ever `join`s/`leave`s; it NEVER disconnects the singleton
 * (spine-owned lifecycle).
 *
 * JOIN-TIME RECONCILE. Room events only reach a MOUNTED screen; anything
 * posted while the user was elsewhere (socket healthy, room left) was missed
 * for good. The message/list/file caches are realtime-tier (`staleTime:
 * Infinity` — events are the staleness signal), so this hook marks those
 * three prefixes stale once per (re)join when they already hold data: the
 * cached rows paint instantly (the feel directive) and the reconcile lands
 * behind them. The spine separately invalidates everything on socket
 * reconnect (gap recovery), so drop-and-reconnect needs nothing here.
 *
 * TYPING (§5): listen for the client-to-client `typing` whisper, show for
 * {@link TYPING_TTL_MS} (10s), clear a typer the moment their message
 * arrives; EMIT at most one whisper per {@link TYPING_EMIT_THROTTLE_MS} (1s).
 *
 * W3 SEAMS — DELIBERATE NO-OPS, LISTED SO THE NEXT WAVE BINDS THEM HERE:
 *  - `.ai.turn_started` / `.ai.turn_failed` → the Lawexa responding pill
 *    keyed by `metadata.execution_id` (W3; digest §F.6/§F.7).
 *  - `.reaction.toggled` → per-message reaction deltas (W3; digest §F.2 — the
 *    payload is per-viewer-safe deltas, never a full row).
 *  - `.message.pinned` / `.message.unpinned` → pin state + pinned surface (W3).
 *  - `.read.updated` → IGNORED for UI by decision D2 (no read-state display);
 *    the caller's own multi-device badge sync rides `.channel.unread` on the
 *    user channel, which the spine already owns.
 *  - `.quiz.game.*` (8 events) → the live-quiz screens (W6); the FEED needs
 *    nothing from them — quiz system cards arrive as ordinary messages.
 */

const TYPING_TTL_MS = 10_000;
const TYPING_EMIT_THROTTLE_MS = 1_000;

export interface TypingUser {
  uuid: string;
  name: string;
}

export interface ChannelRoom {
  /** Presence-derived online membership (includes the viewer). */
  onlineCount: number;
  /** Who is typing right now (never includes the viewer). */
  typingUsers: readonly TypingUser[];
  /** Throttled typing whisper — the composer calls this per keystroke. */
  notifyTyping: () => void;
}

export function useChannelRoom(
  channelUuid: string,
  options: { enabled?: boolean } = {},
): ChannelRoom {
  const enabled = (options.enabled ?? true) && !!channelUuid;
  const queryClient = useQueryClient();
  // The sanctioned token bridge: the presence member id IS the user uuid
  // (digest §B), and the viewer key is what re-acquires the Echo instance on
  // an identity edge (N2). Primitive selectors — stable snapshots.
  const myUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const myName = useAuthStore((state) => state.user?.name ?? '');

  const [onlineUuids, setOnlineUuids] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [typingUsers, setTypingUsers] = useState<readonly TypingUser[]>([]);

  const whisperRef = useRef<((event: string, data: Record<string, unknown>) => void) | null>(null);
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastWhisperAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !myUuid) return;
    const echo = getV2Echo();
    if (!echo) return;

    const name = presenceChannelName(channelUuid);
    const room = echo.join(name);
    whisperRef.current = (event, data) => room.whisper(event, data);
    const typingTimers = typingTimersRef.current;

    const clearTyper = (uuid: string) => {
      const timer = typingTimers.get(uuid);
      if (timer) clearTimeout(timer);
      typingTimers.delete(uuid);
      setTypingUsers((prev) =>
        prev.some((user) => user.uuid === uuid)
          ? prev.filter((user) => user.uuid !== uuid)
          : prev,
      );
    };

    room
      .here((members: SlimUser[]) =>
        setOnlineUuids(new Set(members.map((member) => member.uuid))),
      )
      .joining((member: SlimUser) =>
        setOnlineUuids((prev) => {
          if (prev.has(member.uuid)) return prev;
          const next = new Set(prev);
          next.add(member.uuid);
          return next;
        }),
      )
      .leaving((member: SlimUser) =>
        setOnlineUuids((prev) => {
          if (!prev.has(member.uuid)) return prev;
          const next = new Set(prev);
          next.delete(member.uuid);
          return next;
        }),
      );

    room.listen('.message.created', (payload: Message) => {
      applyMessageCreated(queryClient, payload);
      // A message from someone typing supersedes their indicator (§5's
      // clear-on-send, enforced on the RECEIVING side).
      if (payload.author) clearTyper(payload.author.uuid);
    });
    room.listen('.message.updated', (payload: Message) => {
      // Broadcasts omit the per-viewer fields by design (digest §F.2). The W2
      // `Message` type carries none, so wholesale replacement is exact; the
      // writer's own docblock pins the W3 preserve-fields obligation.
      applyMessageUpdated(queryClient, payload);
    });
    room.listen('.message.deleted', (payload: { uuid: string; channel_uuid: string }) => {
      applyMessageDeleted(queryClient, channelUuid, payload.uuid);
    });

    room.listen('.member.joined', () => {
      noteChannelMembershipChanged(queryClient, channelUuid);
    });
    room.listen('.member.left', (payload: { member?: SlimUser }) => {
      // Self-eviction: no post-auth socket revocation exists (digest §F.11),
      // so leave the room ourselves and let the detail refetch resolve into
      // the designed refusal state.
      if (payload.member?.uuid && payload.member.uuid === myUuid) {
        echo.leave(name);
      }
      noteChannelMembershipChanged(queryClient, channelUuid);
    });

    // Lists & files ride this same room (LF §5) — the N3 writers.
    room.listen(
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
      },
    );
    room.listen(
      '.file.changed',
      (payload: { action: 'added' | 'removed'; file: ChannelFile }) => {
        if (payload.action === 'removed') {
          removeFileCache(queryClient, channelUuid, payload.file.id);
        } else {
          addFileCache(queryClient, channelUuid, payload.file);
        }
      },
    );

    room.listenForWhisper('typing', (payload: TypingUser) => {
      if (!payload?.uuid || payload.uuid === myUuid) return;
      setTypingUsers((prev) => [
        ...prev.filter((user) => user.uuid !== payload.uuid),
        { uuid: payload.uuid, name: payload.name },
      ]);
      const existing = typingTimers.get(payload.uuid);
      if (existing) clearTimeout(existing);
      typingTimers.set(
        payload.uuid,
        setTimeout(() => {
          typingTimers.delete(payload.uuid);
          setTypingUsers((prev) =>
            prev.filter((user) => user.uuid !== payload.uuid),
          );
        }, TYPING_TTL_MS),
      );
    });

    // Join-time reconcile (see docblock): only prefixes that already hold
    // data — a first open is fetching anyway, and invalidating a pending
    // query would only double the request.
    for (const prefix of [
      channelsQueries.messagesOf(channelUuid),
      channelsQueries.taskListsOf(channelUuid),
      channelsQueries.filesOf(channelUuid),
    ]) {
      const hasData = queryClient
        .getQueriesData({ queryKey: prefix })
        .some(([, data]) => data !== undefined);
      if (hasData) {
        void queryClient.invalidateQueries({ queryKey: prefix });
      }
    }

    return () => {
      whisperRef.current = null;
      for (const timer of typingTimers.values()) clearTimeout(timer);
      typingTimers.clear();
      echo.leave(name);
      setOnlineUuids(new Set());
      setTypingUsers([]);
    };
  }, [enabled, channelUuid, myUuid, queryClient]);

  const notifyTyping = useCallback(() => {
    const whisper = whisperRef.current;
    if (!whisper || !myUuid) return;
    const now = Date.now();
    if (now - lastWhisperAtRef.current < TYPING_EMIT_THROTTLE_MS) return;
    lastWhisperAtRef.current = now;
    whisper('typing', { uuid: myUuid, name: myName });
  }, [myUuid, myName]);

  return {
    onlineCount: onlineUuids.size,
    typingUsers,
    notifyTyping,
  };
}
