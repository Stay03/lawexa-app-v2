'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ThreadUpdatedPayload,
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
  applyFileRemovedFromMessages,
  applyMessageCreated,
  applyMessageDeleted,
  applyMessageUpdated,
  applyPinState,
  applyReactionToggled,
  applyThreadStub,
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
import { noteChannelFileRemoved } from './removed-files';
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
 * ── PRESENCE MEANS "HERE NOW", AND AWAY IS A SECOND WHISPER (2026-08-08) ────
 * The room reports WHO is in the channel, not how many: `here`/`joining`/
 * `leaving` carry `{uuid, name, avatar_url}` (digest §B), which is a face and
 * an arrival order. The header draws the people; a bare count is what it used
 * to hide in a tooltip.
 *
 * "I have gone quiet" rides the SAME client-to-client transport as typing, one
 * word apart. On `visibilitychange` — and best-effort again on `pagehide` — the
 * viewer whispers `away {uuid, away}`, and every other device in the room dims
 * that face. Nothing is asked of the backend for this and nothing needs to be.
 *
 * A MISSING SIGNAL MEANS "HERE", NEVER "AWAY" (ruling, 2026-08-06). A pocketed
 * phone frequently never gets to send the goodbye: `visibilitychange` is the
 * last event a page can rely on, `pagehide` covers most of the rest, and a tab
 * killed from the app switcher sends neither. So {@link ChannelPresence.away}
 * starts EMPTY for everyone and only ever fills from a signal that actually
 * arrived — a dim face honestly says "was here, may have stepped away", never
 * "is not looking". Someone who joins after an away whisper never heard it and
 * draws that person bright, which is the correct direction to be wrong in.
 *
 * The one moment a tab can be background WITHOUT a `visibilitychange` to report
 * it is the moment it opened there (a middle-click, a restored session), so the
 * viewer's state is whispered once from inside `here()` — the first instant the
 * whisper transport exists — and only when it is already hidden.
 *
 * A DEPARTURE IS HELD FOR ONE EXIT ANIMATION. `leaving` takes the person out of
 * `here` immediately, so the count is honest on the very frame it changes, and
 * parks them in `departing` for {@link PRESENCE_EXIT_MS} — the header's cue to
 * fade that face instead of blinking it away. The TTL sits here with the typing
 * and turn timers because the room owns every clock on this channel, and the
 * two lists are kept apart precisely so a departing face can never be counted
 * as present.
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
 * THREADS ADDED ONE EVENT (2026-08-12). `.thread.updated` rides the PARENT's
 * room and counts the stub under a root message up as people talk in the branch
 * — the shared number only; the viewer's own unread tally cannot be broadcast
 * and is never touched here.
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

/** How long a departed face is held so the header can play one exit on it.
 *  The house motion budget (200ms), and the header's transition is written to
 *  the same number — a face that outlived its animation would sit fully drawn
 *  on someone who has gone. */
const PRESENCE_EXIT_MS = 200;

export interface TypingUser {
  uuid: string;
  name: string;
}

/**
 * A person as the PRESENCE ROOM describes them — `{uuid, name, avatar_url}`
 * and nothing else (digest §B).
 *
 * Deliberately NOT `SlimUser`: the wire carries no `username` here, and typing
 * it as one would let a mention picker read a handle that was never sent.
 */
export interface PresenceMember {
  uuid: string;
  name: string;
  avatar_url: string | null;
}

/** The `away` whisper: one person telling the room their tab went quiet. */
interface AwayWhisper {
  uuid: string;
  away: boolean;
}

/** Who is in this channel right now, and which of them have gone quiet. */
export interface ChannelPresence {
  /**
   * Everyone the socket says is in the room, in the order they arrived, the
   * viewer included. `null` until the first `here()` lands — "not known yet"
   * is not "nobody", and the two draw differently.
   */
  here: readonly PresenceMember[] | null;
  /** Faces on their way out, held for {@link PRESENCE_EXIT_MS}. Never counted. */
  departing: readonly PresenceMember[];
  /** Of {@link here}, whoever told us their tab is in the background. */
  away: ReadonlySet<string>;
}

export interface ChannelRoom {
  /** Who is here now (includes the viewer) — see {@link ChannelPresence}. */
  presence: ChannelPresence;
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

/** The same trick for presence: one empty list and one empty set, so a quiet
 *  room never hands the header a fresh reference to re-memo against. */
const NO_MEMBERS: readonly PresenceMember[] = [];
const NO_UUIDS: ReadonlySet<string> = new Set();

/** Immutable set edits that return `prev` untouched when nothing changed —
 *  the reference IS the change signal for every consumer downstream. */
function withUuid(prev: ReadonlySet<string>, uuid: string): ReadonlySet<string> {
  if (prev.has(uuid)) return prev;
  const next = new Set(prev);
  next.add(uuid);
  return next;
}

function withoutUuid(prev: ReadonlySet<string>, uuid: string): ReadonlySet<string> {
  if (!prev.has(uuid)) return prev;
  const next = new Set(prev);
  next.delete(uuid);
  return next;
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

  const [here, setHere] = useState<readonly PresenceMember[] | null>(null);
  const [departing, setDeparting] = useState<readonly PresenceMember[]>(NO_MEMBERS);
  const [away, setAway] = useState<ReadonlySet<string>>(NO_UUIDS);
  const [typingUsers, setTypingUsers] = useState<readonly TypingUser[]>([]);
  const [respondingTurns, setRespondingTurns] =
    useState<readonly RespondingTurn[]>(NO_TURNS);

  const whisperRef = useRef<((event: string, data: Record<string, unknown>) => void) | null>(null);
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const turnTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const exitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
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
    const exitTimers = exitTimersRef.current;

    /**
     * Tell the room whether this viewer's tab is in the background.
     *
     * Fire-and-forget by design. A whisper sent in the sliver between `join()`
     * and `subscription_succeeded` is dropped with a console warning by
     * pusher-js rather than thrown, and losing it costs nothing: everyone else
     * keeps reading no-signal as "here", which is the ruling.
     */
    const sendAway = (isAway: boolean) => {
      const whisper = whisperRef.current;
      if (!whisper) return;
      whisper('away', { uuid: myUuid, away: isAway } satisfies AwayWhisper);
    };

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
      .here((members: PresenceMember[]) => {
        // A copy, not the socket's array: this becomes render state, and the
        // reference is what tells the header something changed.
        setHere(members.slice());
        // The one background a `visibilitychange` can never report, because it
        // happened before there was anything to report it to (see docblock).
        if (document.visibilityState === 'hidden') sendAway(true);
      })
      .joining((member: PresenceMember) =>
        setHere((prev) => {
          if (prev === null) return [member];
          return prev.some((person) => person.uuid === member.uuid)
            ? prev
            : [...prev, member];
        }),
      )
      .leaving((member: PresenceMember) => {
        setHere((prev) =>
          prev === null
            ? prev
            : prev.filter((person) => person.uuid !== member.uuid),
        );
        // Out of the count immediately, on screen for one exit animation. The
        // dim (if they had gone quiet first) is released with them, so a
        // reconnect a second later never inherits a stale one.
        setDeparting((prev) =>
          prev.some((person) => person.uuid === member.uuid)
            ? prev
            : [...prev, member],
        );
        const running = exitTimers.get(member.uuid);
        if (running) clearTimeout(running);
        exitTimers.set(
          member.uuid,
          setTimeout(() => {
            exitTimers.delete(member.uuid);
            setDeparting((prev) =>
              prev.filter((person) => person.uuid !== member.uuid),
            );
            setAway((prev) => withoutUuid(prev, member.uuid));
          }, PRESENCE_EXIT_MS),
        );
      });

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

    /* ── The thread stub, counting up live (Threads T1.7) ─────────────────────
          Broadcast on the PARENT's room, not the thread's, on purpose: the
          people who need it are the ones looking at the feed the thread was
          branched out of. Anyone inside the thread is already receiving its
          `.message.created` events.

          `my_unread_count` IS NOT IN THE PAYLOAD AND MUST NOT BE INVENTED. One
          broadcast reaches every member of this room and a per-viewer tally
          cannot be true for all of them, so the writer moves the shared count
          and leaves the viewer's own alone (see `applyThreadStub`).

          A STANDALONE THREAD IS A NO-OP HERE. `root_message_uuid: null` means
          the thread hangs under no message, so there is no stub in this feed to
          update — the event reaches the parent's room anyway (the threads list,
          Phase 4, is what it is for) and this writer has nothing to do. */
    room.listen('.thread.updated', (payload: ThreadUpdatedPayload) => {
      if (payload.root_message_uuid === null) return;
      applyThreadStub(queryClient, channelUuid, payload.root_message_uuid, {
        uuid: payload.thread_uuid,
        title: payload.title,
        message_count: payload.message_count,
        last_message_at: payload.last_message_at,
      });
    });

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
          // One file, one delete: the backend drops it from every message that
          // carried it too, so the transcript (and the pins/saved panels) have
          // to follow the library or a stranger's delete leaves a dead chip on
          // screen here. Nothing rolls back a broadcast, so the reported
          // snapshots have no undo to serve and are discarded.
          applyFileRemovedFromMessages(queryClient, channelUuid, payload.file.id);
          // And the composer, which may be holding this exact file staged for
          // the next send — a chip nobody removed would post an id the server
          // no longer has (`./removed-files.ts`).
          noteChannelFileRemoved(channelUuid, payload.file.id);
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

    room.listenForWhisper('away', (payload: AwayWhisper) => {
      // Our own whisper is never echoed back to us; the guard says so out loud
      // rather than leaving it to Pusher's behaviour, and costs one compare.
      if (!payload?.uuid || payload.uuid === myUuid) return;
      setAway((prev) =>
        payload.away
          ? withUuid(prev, payload.uuid)
          : withoutUuid(prev, payload.uuid),
      );
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

    /* ── The away signal (see docblock) ─────────────────────────────────────
          `visibilitychange` is the last event a page can count on; `pagehide`
          catches most of what it misses. Both say the same word, and neither is
          load-bearing — silence is read as "here" by everyone else. */
    const reportVisibility = () => sendAway(document.visibilityState === 'hidden');
    const reportGone = () => sendAway(true);
    document.addEventListener('visibilitychange', reportVisibility);
    window.addEventListener('pagehide', reportGone);

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
      document.removeEventListener('visibilitychange', reportVisibility);
      window.removeEventListener('pagehide', reportGone);
      whisperRef.current = null;
      for (const timer of typingTimers.values()) clearTimeout(timer);
      typingTimers.clear();
      for (const timer of turnTimers.values()) clearTimeout(timer);
      turnTimers.clear();
      for (const timer of exitTimers.values()) clearTimeout(timer);
      exitTimers.clear();
      echo.leave(name);
      // Back to "not known yet", never to "nobody": the next room this hook
      // joins has to earn its faces, and a stale set would draw the previous
      // channel's people for a frame.
      setHere(null);
      setDeparting(NO_MEMBERS);
      setAway(NO_UUIDS);
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

  // Three stable state references in a plain bundle: the object is new each
  // render, the lists inside it are not, so the header's memo only re-runs when
  // someone actually arrived, left or went quiet.
  const presence = useMemo<ChannelPresence>(
    () => ({ here, departing, away }),
    [here, departing, away],
  );

  return {
    presence,
    typingUsers,
    respondingTurns,
    notifyTyping,
  };
}
