'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  AiTurnFailedPayload,
  AiTurnStartedPayload,
  ChannelFile,
  Message,
  MessagePinPayload,
  ReactionToggledPayload,
  SlimUser,
  TaskList,
} from '@/types/collab';
import type {
  QuizAnswerProgressPayload,
  QuizCancelledPayload,
  QuizCountdownPayload,
  QuizFinishedPayload,
  QuizGameLivePayload,
  QuizPlayerJoinedPayload,
  QuizQuestionClosedPayload,
  QuizQuestionOpenedPayload,
} from '@/types/channel-quiz';
import { getV2Echo } from '@/v2/runtime/realtime/echo';
import { presenceChannelName } from '@/v2/runtime/realtime/protocol';
import {
  applyMessageCreated,
  applyMessageDeleted,
  applyMessageUpdated,
  applyPinState,
  applyReactionToggled,
  noteChannelMembershipChanged,
} from './cache';
import {
  addRespondingTurn,
  dropRespondingTurn,
  resolvedExecutionId,
  RESPONDING_TURN_TTL_MS,
  type RespondingTurn,
} from './lawexa/turns';
import {
  addFileCache,
  removeFileCache,
  removeListCaches,
  upsertListCaches,
} from './lists-files-cache';
import { channelsQueries } from './queries';
import { publishQuizGameEvent } from './quiz/game-bus';
import { channelQuizQueries } from './quiz/queries';

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
 * W3 BOUND THE ENGAGEMENT + LAWEXA SEAMS (2026-08-04):
 *  - `.reaction.toggled` → a per-emoji DELTA onto the message cache. The
 *    payload is per-viewer-safe by design (digest §F.2): it names the reacting
 *    user, so `reacted_by_me` is only touched when that user IS the viewer.
 *  - `.message.pinned` / `.message.unpinned` → the SHARED pin flag, plus an
 *    invalidation of the pins panel (the event carries no message body, so the
 *    list cannot be hand-patched).
 *  - `.ai.turn_started` / `.ai.turn_failed` → the responding-row machine
 *    (`./lawexa/turns.ts` holds the rules and the reasoning).
 *
 * W6 BOUND THE LIVE-QUIZ SEAM (2026-08-04). The eight `.quiz.game.*` events
 * ride THIS room (digest §B — no second subscription exists or may exist), so
 * the room listens for them and republishes them on `./quiz/game-bus.ts`,
 * where whichever quiz surface is mounted picks them up. The room itself keeps
 * no game state: the game's authority is `GET /api/quiz-games/{game}` and the
 * events are a fast path over it. The three events that change whether a game
 * is live (`live`, `finished`, `cancelled`) also invalidate the channel's
 * live-game probe, so the quiz cards sitting in the feed tell the truth
 * without a screen being open.
 *
 * STILL A DELIBERATE NO-OP:
 *  - `.read.updated` → IGNORED for UI by decision D2 (no read-state display);
 *    the caller's own multi-device badge sync rides `.channel.unread` on the
 *    user channel, which the spine already owns.
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
  /** Lawexa summons still in flight in this channel — each drives one
   *  "responding" row. Stable reference between real changes. */
  respondingTurns: readonly RespondingTurn[];
  /** Throttled typing whisper — the composer calls this per keystroke. */
  notifyTyping: () => void;
}

/** Frozen empty list so a channel with no live summon hands out one stable
 *  reference forever (memo-friendly, like the outbox's `NO_MESSAGES`). */
const NO_TURNS: readonly RespondingTurn[] = [];

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
  const [respondingTurns, setRespondingTurns] =
    useState<readonly RespondingTurn[]>(NO_TURNS);

  const whisperRef = useRef<((event: string, data: Record<string, unknown>) => void) | null>(null);
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const turnTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastWhisperAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !myUuid) return;
    const echo = getV2Echo();
    if (!echo) return;

    const name = presenceChannelName(channelUuid);
    const room = echo.join(name);
    whisperRef.current = (event, data) => room.whisper(event, data);
    const typingTimers = typingTimersRef.current;
    const turnTimers = turnTimersRef.current;

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

    /** End a turn from any of its three exits (reply / failure / TTL). */
    const endTurn = (executionId: string) => {
      const timer = turnTimers.get(executionId);
      if (timer) clearTimeout(timer);
      turnTimers.delete(executionId);
      setRespondingTurns((prev) => dropRespondingTurn(prev, executionId));
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
      // Lawexa's answer retires its own turn — exact id match only, FIRST one
      // wins (`./lawexa/turns.ts` explains why the guess is gone).
      const executionId = resolvedExecutionId(payload);
      if (executionId) endTurn(executionId);
    });
    room.listen('.message.updated', (payload: Message) => {
      // Broadcasts omit `is_bookmarked` + `reactions` by design (digest §F.2);
      // the writer merges the cached row's values back in, so a stranger's edit
      // cannot wipe the viewer's saves or reaction state.
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

    /* ── Engagement (3e/3f) ─────────────────────────────────────────────── */

    room.listen('.reaction.toggled', (payload: ReactionToggledPayload) => {
      applyReactionToggled(queryClient, channelUuid, {
        messageUuid: payload.message_uuid,
        emoji: payload.emoji,
        count: payload.count,
        // The per-viewer half of the row moves ONLY for the viewer's own
        // reaction; a stranger's toggle changes the count and nothing else.
        reactedByMe: payload.user_uuid === myUuid ? payload.reacted : null,
      });
    });

    const onPinChanged = (payload: MessagePinPayload) => {
      applyPinState(queryClient, channelUuid, payload.message_uuid, payload.is_pinned);
      // The panel needs `pinned_by` + `pinned_at`, which this event doesn't
      // carry — so the list is invalidated rather than patched. Only when it
      // is already cached: an unopened panel must not fetch on someone else's
      // pin.
      const pinsKey = channelsQueries.pinsOf(channelUuid);
      const cached = queryClient
        .getQueriesData({ queryKey: pinsKey })
        .some(([, data]) => data !== undefined);
      if (cached) void queryClient.invalidateQueries({ queryKey: pinsKey });
    };
    room.listen('.message.pinned', onPinChanged);
    room.listen('.message.unpinned', onPinChanged);

    /* ── Lawexa turns (§B, §F.6/§F.7) ───────────────────────────────────── */

    room.listen('.ai.turn_started', (payload: AiTurnStartedPayload) => {
      if (!payload.execution_id) return;
      const executionId = payload.execution_id;
      setRespondingTurns((prev) =>
        addRespondingTurn(prev, {
          executionId,
          summoner: payload.summoner,
          // Tolerant anchoring — see `./lawexa/turns.ts` and digest §F.7.
          messageUuid: payload.message_uuid ?? null,
          startedAt: Date.now(),
        }),
      );
      const existing = turnTimers.get(executionId);
      if (existing) clearTimeout(existing);
      turnTimers.set(
        executionId,
        setTimeout(() => endTurn(executionId), RESPONDING_TURN_TTL_MS),
      );
    });

    room.listen('.ai.turn_failed', (payload: AiTurnFailedPayload) => {
      if (payload.execution_id) endTurn(payload.execution_id);
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

    /* ── Live quiz (W6) ─────────────────────────────────────────────────── */

    /** A game going live, ending or being cancelled changes the answer to
     *  "is a quiz running here?" — which every quiz card in the feed reads. */
    const invalidateLiveProbe = () => {
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.activeGameOf(channelUuid),
      });
    };

    room.listen('.quiz.game.live', (payload: QuizGameLivePayload) => {
      publishQuizGameEvent(channelUuid, { type: 'live', payload });
      invalidateLiveProbe();
    });
    room.listen('.quiz.game.player_joined', (payload: QuizPlayerJoinedPayload) => {
      publishQuizGameEvent(channelUuid, { type: 'player_joined', payload });
    });
    room.listen('.quiz.game.countdown', (payload: QuizCountdownPayload) => {
      publishQuizGameEvent(channelUuid, { type: 'countdown', payload });
    });
    room.listen('.quiz.game.question_opened', (payload: QuizQuestionOpenedPayload) => {
      publishQuizGameEvent(channelUuid, { type: 'question_opened', payload });
    });
    room.listen('.quiz.game.answer_progress', (payload: QuizAnswerProgressPayload) => {
      publishQuizGameEvent(channelUuid, { type: 'answer_progress', payload });
    });
    room.listen('.quiz.game.question_closed', (payload: QuizQuestionClosedPayload) => {
      publishQuizGameEvent(channelUuid, { type: 'question_closed', payload });
    });
    room.listen('.quiz.game.finished', (payload: QuizFinishedPayload) => {
      publishQuizGameEvent(channelUuid, { type: 'finished', payload });
      invalidateLiveProbe();
    });
    room.listen('.quiz.game.cancelled', (payload: QuizCancelledPayload) => {
      publishQuizGameEvent(channelUuid, { type: 'cancelled', payload });
      invalidateLiveProbe();
    });

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
      for (const timer of turnTimers.values()) clearTimeout(timer);
      turnTimers.clear();
      echo.leave(name);
      setOnlineUuids(new Set());
      setTypingUsers([]);
      // Turns are live socket state, never history: leaving the room ends
      // them on screen. The server keeps running; the reply will arrive as an
      // ordinary message next time the reader is here.
      setRespondingTurns(NO_TURNS);
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
    respondingTurns,
    notifyTyping,
  };
}
