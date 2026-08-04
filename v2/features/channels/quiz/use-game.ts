'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { extractApiError } from '@/lib/utils/api-error';
import type { QuizGameState, QuizGameStateResponse } from '@/types/channel-quiz';
import type { SlimUser } from '@/types/collab';
import {
  eventGameUuid,
  subscribeToQuizGameEvents,
  type QuizGameEvent,
} from './game-bus';
import {
  FINAL_REVEAL_HOLD_MS,
  gamePhase,
  isHost as isHostOf,
  isOlderSnapshot,
  isPlaying as isPlayingIn,
  isRevealed,
  type QuizGamePhase,
} from './model';
import { useCancelGame, useJoinGame, useStartGame, useSubmitAnswer } from './mutations';
import { channelQuizQueries } from './queries';

/**
 * useLiveGame — the whole live game as one hook: the authoritative state, the
 * event fast-path, the reveal hold, and the reader's single one-shot answer.
 *
 * Sources: `docs/api/channel-quiz.md` (backend repo, the state envelope and
 * the 8 events) and `api-digest.md` §B/§E — phase-5 W6, 2026-08-04.
 *
 * ── ONE AUTHORITY, TWO TRANSPORTS ───────────────────────────────────────────
 * `GET /api/quiz-games/{game}` is the contract's own reconnect endpoint and
 * therefore this hook's source of truth. Broadcasts are a FAST PATH laid over
 * it: an event merges into the same cache entry so the screen moves in the
 * frame it arrives, and the poll behind it confirms (or corrects) the merge.
 *
 * That ordering is not defensive design for its own sake — broadcast emission
 * is DOWN in production right now (backend ask 2026-08-04), so this game must
 * be, and is, fully playable with zero events. The polling cadence and its
 * reasoning live in `./model.ts` (`pollDelayMs`); the query wires it in
 * `./queries.ts`. When emission returns, events simply arrive first and the
 * next poll finds nothing new.
 *
 * ── WHAT AN EVENT CANNOT CARRY ──────────────────────────────────────────────
 * Two facts are per-viewer and never ride the room's broadcasts:
 *  - `your_answer.is_correct` / `points` — so `question_closed` merges the
 *    SHARED half of the reveal (correct option, distribution, leaderboard) and
 *    immediately refetches for the reader's own result;
 *  - `answer_progress` has no home in the state envelope at all, so it is held
 *    as local state and simply DOES NOT RENDER when no event delivered it —
 *    an honest absence beats an invented meter.
 *
 * ── THE FINAL REVEAL HOLD ───────────────────────────────────────────────────
 * `quiz.game.finished` arrives immediately after the last `question_closed`
 * (documented gap, digest §E), so the podium would otherwise replace the last
 * answer within a frame. The hook keeps rendering the reveal it was showing
 * for {@link FINAL_REVEAL_HOLD_MS} and only then adopts the finished snapshot.
 * It holds ONLY when it actually saw that reveal: opening a game that finished
 * an hour ago goes straight to the podium.
 *
 * ── STATE DISCIPLINE ────────────────────────────────────────────────────────
 * Every derived reset here is a RENDER-PHASE adjust (React's sanctioned
 * "adjusting state when props change"), never a `setState` inside an effect —
 * the house React Compiler lint rules are errors, and the pattern is also
 * simply correct: the reset lands in the same commit as the change that caused
 * it, so no frame ever shows a stale pick under a new question.
 */

/* ── Pure event merges (the fast path) ────────────────────────────────────── */

/**
 * Fold one event into a state envelope. Returns the SAME reference when the
 * event changes nothing, so an unrelated frame can never re-render the screen.
 * Every merge is a best-effort optimisation over the authoritative GET — if a
 * shape here ever disagreed with the server, the next poll silently wins.
 *
 * NOTHING MOVES THE GAME BACKWARDS. Broadcasts are fire-and-forget (digest
 * §F.11): a frame can arrive late, out of order, or twice. So every merge is
 * computed first and then checked against `isOlderSnapshot` — the SAME
 * ordering the query's `structuralSharing` uses — and a merge that would
 * rewind the timeline (a duplicate `countdown` after the first question opens,
 * a re-delivered `question_opened` for a question already revealed) is
 * discarded. `question_closed` keeps its own explicit index match as well,
 * because a reveal for a question this client never saw open needs the
 * authoritative read for the question body, not a partial merge.
 */
function applyQuizEvent(
  state: QuizGameState,
  event: QuizGameEvent,
): QuizGameState {
  const next = mergeQuizEvent(state, event);
  return next !== state && isOlderSnapshot(next, state) ? state : next;
}

function mergeQuizEvent(
  state: QuizGameState,
  event: QuizGameEvent,
): QuizGameState {
  switch (event.type) {
    case 'live':
      // A go-live for THIS game (the host's own screen, racing its 201).
      return { ...state, game: event.payload.game };

    case 'player_joined': {
      const { user, player_count } = event.payload;
      const players = state.game.players ?? [];
      const known = players.some((player) => player.user.uuid === user.uuid);
      return {
        ...state,
        game: {
          ...state.game,
          player_count,
          players: known
            ? players
            : [
                ...players,
                {
                  // Provisional until the next authoritative read: a joiner
                  // starts on zero and sorts last, which is exactly true.
                  rank: players.length + 1,
                  user,
                  score: 0,
                  joined_at_question_index: state.game.current_question_index,
                },
              ],
        },
      };
    }

    case 'countdown':
      return {
        ...state,
        game: {
          ...state.game,
          status: 'countdown',
          countdown_ends_at: event.payload.countdown_ends_at,
          question_count: event.payload.question_count,
        },
        current_question: null,
        your_answer: null,
      };

    case 'question_opened': {
      const { index, question, opens_at, ends_at, question_count } = event.payload;
      return {
        ...state,
        game: {
          ...state.game,
          status: 'question_open',
          question_count,
          current_question_index: index,
          question_opens_at: opens_at,
          question_ends_at: ends_at,
        },
        // A fresh question carries NO reveal keys — that is what makes it a
        // question rather than an answer.
        current_question: { index, question, opens_at, ends_at },
        your_answer: null,
      };
    }

    case 'question_closed': {
      const current = state.current_question;
      // A reveal for a question this client never saw open (a late join, a
      // slept tab): let the authoritative read supply the question body.
      if (!current || current.index !== event.payload.index) return state;
      return {
        ...state,
        game: {
          ...state.game,
          status: 'reveal',
          players: event.payload.leaderboard ?? state.game.players,
        },
        current_question: {
          ...current,
          correct_option_id: event.payload.correct_option_id,
          option_counts: event.payload.option_counts,
          no_answer_count: event.payload.no_answer_count,
        },
      };
    }

    case 'finished':
      return { ...state, game: { ...state.game, status: 'finished' } };

    case 'cancelled':
      return { ...state, game: { ...state.game, status: 'cancelled' } };

    default:
      return state;
  }
}

/* ── Refusal copy ─────────────────────────────────────────────────────────── */

/**
 * The one `409` sentence that cannot be told apart from the others by status
 * alone — see {@link answerRefusalCopy} and its resolution below.
 */
const ANSWER_CLOSED_NOTE = 'That question closed before your answer arrived.';
const ALREADY_ANSWERED_NOTE =
  'Your answer for this question was already in — it only counts once.';

/**
 * Turn an answer failure into one honest sentence — or `null` when the reader
 * already has the explanation.
 *
 * Keyed on STATUS, never on message text (digest §F.5: the backend
 * deliberately returns uniform copy for distinct causes elsewhere, and
 * string-matching a server sentence is how a client breaks silently).
 *
 * `409` COVERS FOUR CAUSES — nothing open, a stale question, a passed
 * deadline, and an answer already recorded — and the status cannot separate
 * them. Three of the four mean the same thing to a player ("too late"), so
 * they share a sentence; the fourth is genuinely different and would be
 * confusing under that copy, because the player DID answer. It is resolved
 * where the evidence is: this refusal triggers an authoritative read, and if
 * the envelope comes back holding a `your_answer` for this question, the note
 * is swapped for {@link ALREADY_ANSWERED_NOTE} in render (audit L12). No
 * guess, no string match — the server's own state settles it.
 */
function answerRefusalCopy(error: unknown): string | null {
  const { status } = extractApiError(error);
  switch (status) {
    case 403:
      return 'You joined after this question started — you play from the next one.';
    case 409:
      return ANSWER_CLOSED_NOTE;
    case 422:
      return "That option doesn't belong to this question.";
    case 429:
      // The option grid goes quiet on its own (engagement throttle) — saying
      // it twice would be noise.
      return null;
    default:
      return "Your answer didn't reach the server, so nothing was recorded.";
  }
}

/* ── The hook ─────────────────────────────────────────────────────────────── */

export interface AnswerProgress {
  answered: number;
  total: number;
}

export interface LiveGame {
  /** First load of the state envelope. */
  isPending: boolean;
  isError: boolean;
  /** HTTP status of the load failure (`403` = not a member of the channel). */
  errorStatus: number;
  retry: () => void;

  /** What the screen must draw — the authoritative snapshot, except during the
   *  final-reveal hold when it is deliberately one step behind. */
  state: QuizGameState | null;
  phase: QuizGamePhase;
  /** True while the last reveal is being held before the podium. */
  holdingFinalReveal: boolean;

  isHost: boolean;
  isPlaying: boolean;

  /** The option this reader tapped, locked the moment they tapped it. */
  pendingOptionId: number | null;
  /** A designed explanation for a refused answer — never a toast. */
  answerNote: string | null;
  answering: boolean;
  submitAnswer: (optionId: number) => void;

  /** Live answer count for the open question — `null` when no broadcast
   *  delivered it (currently the norm: emission is down). */
  progress: AnswerProgress | null;
  /** Who cancelled — only known when the broadcast delivered it; `null` may
   *  mean the idle-lobby auto-cancel OR simply "not known here". */
  cancelledBy: SlimUser | null;

  join: () => void;
  joining: boolean;
  joinErrorStatus: number;
  start: () => void;
  starting: boolean;
  cancel: () => void;
  cancelling: boolean;
}

export function useLiveGame({
  channelUuid,
  gameUuid,
  viewerId,
  viewerUuid,
}: {
  channelUuid: string;
  gameUuid: string;
  viewerId: number | null;
  viewerUuid: string | null;
}): LiveGame {
  const queryClient = useQueryClient();
  const query = useQuery(channelQuizQueries.gameState({ gameUuid, viewerId }));
  const snapshot = query.data?.data ?? null;

  /* ── The final-reveal hold (see the docblock) ───────────────────────────── */
  const [shown, setShown] = useState<QuizGameState | null>(snapshot);
  const [holding, setHolding] = useState(false);

  if (snapshot !== null && snapshot !== shown && !holding) {
    // Render-phase adopt. The ONE exception is the moment a game we watched
    // reveal its last answer reports itself finished.
    if (
      snapshot.game.status === 'finished' &&
      shown !== null &&
      isRevealed(shown)
    ) {
      setHolding(true);
    } else {
      setShown(snapshot);
    }
  }

  useEffect(() => {
    if (!holding) return;
    const timer = setTimeout(() => setHolding(false), FINAL_REVEAL_HOLD_MS);
    return () => clearTimeout(timer);
  }, [holding]);

  /* ── The reader's one answer, reset per question ────────────────────────── */
  const questionUuid = shown?.current_question?.question.uuid ?? null;
  const [answerFor, setAnswerFor] = useState<string | null>(questionUuid);
  const [pendingOptionId, setPendingOptionId] = useState<number | null>(null);
  const [answerNote, setAnswerNote] = useState<string | null>(null);

  if (questionUuid !== answerFor) {
    // A new question wipes the previous pick and any refusal, in the same
    // commit that brings the new question on screen.
    setAnswerFor(questionUuid);
    setPendingOptionId(null);
    setAnswerNote(null);
  }

  /* ── Broadcast-only facts ──────────────────────────────────────────────── */
  const [progress, setProgress] = useState<
    (AnswerProgress & { index: number }) | null
  >(null);
  const [cancelledBy, setCancelledBy] = useState<SlimUser | null>(null);

  /* ── Mutations ─────────────────────────────────────────────────────────── */
  const answerMutation = useSubmitAnswer(gameUuid, viewerId);
  const joinMutation = useJoinGame(gameUuid, viewerId);
  const startMutation = useStartGame(gameUuid, viewerId);
  const cancelMutation = useCancelGame(gameUuid, viewerId, channelUuid);

  /* ── The event fast path ───────────────────────────────────────────────── */
  useEffect(() => {
    const key = channelQuizQueries.gameState({ gameUuid, viewerId }).queryKey;

    return subscribeToQuizGameEvents(channelUuid, (event) => {
      if (eventGameUuid(event) !== gameUuid) return;

      if (event.type === 'answer_progress') {
        setProgress({
          index: event.payload.index,
          answered: event.payload.answered_count,
          total: event.payload.player_count,
        });
        return;
      }

      if (event.type === 'cancelled') {
        setCancelledBy(event.payload.cancelled_by);
      }

      queryClient.setQueryData<QuizGameStateResponse>(key, (previous) => {
        if (!previous) return previous;
        const next = applyQuizEvent(previous.data, event);
        return next === previous.data ? previous : { ...previous, data: next };
      });

      // ONLY the reveal forces an authoritative read, and it must: the
      // reader's own correctness and points are per-viewer and never ride a
      // broadcast, so the merge above can only deliver half of a reveal.
      //
      // Every other merge is COMPLETE for rendering (a `question_opened`
      // carries the whole question; a `countdown` carries its deadline), and
      // the poll behind them confirms within its cadence anyway — invalidating
      // on each of them would turn a busy lobby's join burst into a burst of
      // requests and reset the polling timer every time.
      if (event.type === 'question_closed') {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    });
  }, [channelUuid, gameUuid, viewerId, queryClient]);

  /* ── Derived ───────────────────────────────────────────────────────────── */
  const phase: QuizGamePhase = shown ? gamePhase(shown) : 'lobby';
  const currentIndex = shown?.current_question?.index ?? null;

  const submitAnswer = useCallback(
    (optionId: number) => {
      const question = shown?.current_question?.question;
      if (!question) return;
      // One answer per player per question, enforced here as well as by the
      // server: a second tap must not even leave the device.
      if (pendingOptionId !== null || shown?.your_answer) return;

      setPendingOptionId(optionId);
      setAnswerNote(null);
      answerMutation.mutate(
        { question: question.uuid, option_id: optionId },
        {
          onError: (error) => {
            setPendingOptionId(null);
            setAnswerNote(answerRefusalCopy(error));
            // A refusal is also NEWS: the server knows something this screen
            // does not (the question moved on, or an answer of ours is already
            // recorded). Read it back — that read is what lets the note below
            // name the already-answered case instead of guessing at it.
            void queryClient.invalidateQueries({
              queryKey: channelQuizQueries.gameState({ gameUuid, viewerId })
                .queryKey,
            });
          },
        },
      );
    },
    [shown, pendingOptionId, answerMutation, queryClient, gameUuid, viewerId],
  );

  const join = useCallback(() => joinMutation.mutate(), [joinMutation]);
  const start = useCallback(() => startMutation.mutate(), [startMutation]);
  const cancel = useCallback(() => cancelMutation.mutate(), [cancelMutation]);

  return {
    isPending: query.isPending,
    isError: query.isError,
    errorStatus: query.isError ? extractApiError(query.error).status : 0,
    retry: () => void query.refetch(),

    state: shown,
    phase,
    holdingFinalReveal: holding,

    isHost: shown ? isHostOf(shown, viewerUuid) : false,
    isPlaying: shown ? isPlayingIn(shown, viewerUuid) : false,

    pendingOptionId,
    // The 409 resolution (L12): a "too late" note standing over a snapshot
    // that DOES hold an answer for this question can only be the
    // already-answered case — say so instead of telling a player who answered
    // that they were too slow.
    answerNote:
      answerNote === ANSWER_CLOSED_NOTE && shown?.your_answer != null
        ? ALREADY_ANSWERED_NOTE
        : answerNote,
    answering: answerMutation.isPending,
    submitAnswer,

    // A meter from a previous question would be a lie about this one.
    progress:
      progress && currentIndex !== null && progress.index === currentIndex
        ? { answered: progress.answered, total: progress.total }
        : null,
    cancelledBy,

    join,
    joining: joinMutation.isPending,
    joinErrorStatus: joinMutation.isError
      ? extractApiError(joinMutation.error).status
      : 0,
    start,
    starting: startMutation.isPending,
    cancel,
    cancelling: cancelMutation.isPending,
  };
}
