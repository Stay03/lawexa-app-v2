'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { extractApiError } from '@/lib/utils/api-error';
import type {
  QuizCurrentQuestion,
  QuizGameState,
  QuizGameStateResponse,
} from '@/types/channel-quiz';
import type { SlimUser } from '@/types/collab';
import {
  eventGameUuid,
  subscribeToQuizGameEvents,
  type QuizGameEvent,
} from './game-bus';
import {
  answersIn,
  FINAL_ANSWER_HOLD_MS,
  FINAL_REVEAL_HOLD_MS,
  gamePhase,
  isHost as isHostOf,
  isOlderSnapshot,
  isPlaying as isPlayingIn,
  isRevealedQuestion,
  isTerminalPhase,
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
 * `your_answer.is_correct` / `points` are per-viewer and never ride the room's
 * broadcasts, so `question_closed` merges the SHARED half of the reveal
 * (correct option, distribution, leaderboard) and immediately refetches for the
 * reader's own result.
 *
 * Everything else an event carries now has a home in the state envelope,
 * including who has answered: `answer_progress` extends
 * `current_question.answers_in` when it happens to arrive, and the poll behind
 * it carries the same fact when it does not — which is what makes the answering
 * rail work today, with emission down.
 *
 * ONE broadcast-only fact remains, and it is a name rather than a state: WHO
 * cancelled a game (`cancelledBy`). The envelope reports that a game was
 * cancelled and nothing about by whom, so with no event the screen says less
 * instead of guessing.
 *
 * ── THE TWO ENDINGS ─────────────────────────────────────────────────────────
 * A game can end in two shapes, and each gets one held beat before the podium
 * so the last thing the reader saw is not replaced within a frame:
 *
 *  - AFTER A REVEAL. `quiz.game.finished` arrives immediately after the last
 *    `question_closed` (documented gap, digest §E), so the reveal is held for
 *    {@link FINAL_REVEAL_HOLD_MS}.
 *  - WITHOUT ONE, which is the normal path. A question closes as soon as every
 *    eligible player has answered, so the last question goes straight from
 *    `question_open` to `finished` and its reveal is never published at all
 *    (measured, 2026-08-04). The hook keeps the question it was showing and
 *    hands it to `FinalAnswerStage`, which closes the loop from the RESULTS —
 *    see that component for what is real and what is deliberately not claimed.
 *
 * Both hold ONLY what this screen actually watched: opening a game that
 * finished an hour ago goes straight to the podium. A hold ends by adopting the
 * snapshot it deferred, which is also what stops it re-arming itself the
 * instant it releases.
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
          next_question_opens_at: null,
        },
        // A fresh question carries NO reveal keys — that is what makes it a
        // question rather than an answer — and nobody has answered it yet.
        //
        // `is_final` is the one field the state read has and this broadcast
        // does not, so it is derived from the two numbers the payload DOES
        // carry rather than left out: the index is 0-based (measured), so the
        // last question is `question_count - 1`. That is arithmetic on server
        // values, not a guess, and the poll behind this merge replaces the
        // whole object with the server's own answer within its cadence anyway.
        current_question: {
          index,
          question,
          opens_at,
          ends_at,
          is_final: index === question_count - 1,
          answers_in: [],
          next_opens_at: null,
        },
        your_answer: null,
      };
    }

    case 'answer_progress': {
      // AN ACCELERATOR, NEVER THE SOURCE. The list itself lives in the state
      // read; this only puts a face on screen a beat earlier when the event
      // happens to carry one. The three fields are typed optional because no
      // wire has ever delivered them (emission is down), so an event without
      // them changes nothing at all rather than half-writing a row.
      const { index, player, response_ms, answered_at } = event.payload;
      const current = state.current_question;
      if (!current || current.index !== index) return state;
      if (!player || response_ms === undefined || answered_at === undefined) {
        return state;
      }
      const arrivals = answersIn(current);
      if (arrivals.some((entry) => entry.user.uuid === player.uuid)) {
        return state;
      }
      return {
        ...state,
        current_question: {
          ...current,
          // Arrival order: the event IS the arrival.
          answers_in: [...arrivals, { user: player, answered_at, response_ms }],
        },
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
          // The server's own word about the last question, which replaces the
          // value `question_opened` had to derive.
          is_final: event.payload.is_final,
          // The gap's deadline, when the payload carries it — the same
          // accelerator rule as `answer_progress`: absent, the state read
          // supplies it; present, the countdown starts a beat earlier.
          next_opens_at: event.payload.next_opens_at ?? current.next_opens_at,
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
      // A failure with no response is the one case where we know NOTHING: the
      // request may have been recorded and the answer lost on the way back.
      // Claiming "nothing was recorded" would be a guess the scoreboard can
      // contradict a minute later.
      return "We didn't hear back about that answer — if it reached us, it still counts.";
  }
}

/* ── What the server says this reader did ─────────────────────────────────── */

/**
 * THE READER'S OWN ANSWER TO THE QUESTION ON SCREEN, as far as the SERVER is
 * concerned. Three states, and the third is the one that matters:
 *
 *  - `answered` — the server has it. Either a state read stamped `your_answer`
 *    or the answer endpoint returned a receipt for THIS question. This is the
 *    only value a screen may judge right or wrong.
 *  - `none` — nothing was sent for this question, or what was sent was refused
 *    outright (joined too late, foreign option, throttled). Saying "no answer
 *    from you" is true.
 *  - `unknown` — a tap whose fate we never learned: still in flight, lost to
 *    the network, or refused with the one status that cannot tell an accepted
 *    answer from a rejected one (`409` covers both "already answered" and "too
 *    late"). The server may well have scored it, so the screen must not claim
 *    the reader did nothing.
 *
 * WHY THE DISTINCTION EARNS ITS KEEP. A locally tapped option is enough to lock
 * a grid, but it is NOT enough to paint a green tick: if the question closes
 * early while the POST is in flight, the reveal can arrive before the refusal,
 * and a screen keyed off the tap would show a correct answer the player never
 * gave. And at the end of a game, treating "we never learned" as "you did not
 * answer" tells a player they skipped a question the podium then scores for
 * them five seconds later.
 */
export type AnswerStanding =
  | { kind: 'answered'; optionId: number }
  | { kind: 'unknown' }
  | { kind: 'none' };

/** Statuses that mean the answer definitively never reached the scoreboard —
 *  the server refused it outright rather than ambiguously. */
const REJECTED_STATUSES = new Set([403, 422, 429]);

function readAnswerStanding(
  yourAnswerOptionId: number | null,
  submission: {
    /** Does the in-hand mutation name the question on screen? */
    mine: boolean;
    isPending: boolean;
    receiptOptionId: number | null;
    errorStatus: number | null;
  },
): AnswerStanding {
  if (yourAnswerOptionId !== null) {
    return { kind: 'answered', optionId: yourAnswerOptionId };
  }
  if (!submission.mine) return { kind: 'none' };
  if (submission.receiptOptionId !== null) {
    return { kind: 'answered', optionId: submission.receiptOptionId };
  }
  if (submission.isPending) return { kind: 'unknown' };
  if (submission.errorStatus !== null) {
    return REJECTED_STATUSES.has(submission.errorStatus)
      ? { kind: 'none' }
      : { kind: 'unknown' };
  }
  return { kind: 'none' };
}

/* ── The hook ─────────────────────────────────────────────────────────────── */

/**
 * The last question, kept because the game finished without ever revealing it.
 * Handed to `FinalAnswerStage`, which closes it from the results.
 */
export interface FinalAnswerClose {
  /** The question as the screen last held it — never revealed. */
  question: QuizCurrentQuestion;
  /** What the server says this reader did with it. */
  standing: AnswerStanding;
}

/**
 * A deferred ending: what the screen is still showing, and the snapshot it will
 * adopt when the beat is over. Holding the deferred snapshot HERE is what makes
 * the release final — the hold cannot re-arm itself against a state it has
 * already adopted.
 */
type EndingHold =
  | { kind: 'reveal'; next: QuizGameState }
  | { kind: 'final-answer'; next: QuizGameState; question: QuizCurrentQuestion };

/** Which ending, if any, the arrival of `incoming` starts. */
function endingHoldFor(
  shown: QuizGameState | null,
  incoming: QuizGameState,
): EndingHold | null {
  if (incoming.game.status !== 'finished') return null;
  const current = shown?.current_question;
  // No question on screen means nothing to hold: a reader who opened a game
  // that was already over goes straight to the podium.
  if (!current) return null;
  return isRevealedQuestion(current)
    ? { kind: 'reveal', next: incoming }
    : { kind: 'final-answer', next: incoming, question: current };
}

export interface LiveGame {
  /** First load of the state envelope. */
  isPending: boolean;
  isError: boolean;
  /** HTTP status of the load failure (`403` = not a member of the channel). */
  errorStatus: number;
  /**
   * A BACKGROUND read failed while a game is still on screen. Not an error
   * state: the game keeps playing, the frame says so quietly, and the recovery
   * beat is already asking again.
   */
  readFailing: boolean;
  retry: () => void;

  /** What the screen must draw — the authoritative snapshot, except during an
   *  ending hold when it is deliberately one step behind. */
  state: QuizGameState | null;
  phase: QuizGamePhase;
  /** True while the last reveal is being held before the podium. */
  holdingFinalReveal: boolean;
  /** Non-null while the last question is being closed from the results because
   *  the game finished without revealing it. */
  closingAnswer: FinalAnswerClose | null;
  /** End the current hold now — the reader asked for the scores. */
  skipToScores: () => void;

  isHost: boolean;
  isPlaying: boolean;

  /** The option this reader tapped, locked the moment they tapped it. Good for
   *  locking a grid; NEVER good enough to judge — see {@link AnswerStanding}. */
  pendingOptionId: number | null;
  /** What the SERVER says this reader did with the question on screen. */
  answerStanding: AnswerStanding;
  /** A designed explanation for a refused answer — never a toast. */
  answerNote: string | null;
  answering: boolean;
  submitAnswer: (optionId: number) => void;

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

  /* ── The ending holds (see the docblock) ────────────────────────────────── */
  const [shown, setShown] = useState<QuizGameState | null>(snapshot);
  const [hold, setHold] = useState<EndingHold | null>(null);

  if (snapshot !== null && snapshot !== shown && hold === null) {
    // Render-phase adopt. The ONE exception is a game reporting itself finished
    // while a question of it is still on this screen.
    const ending = endingHoldFor(shown, snapshot);
    if (ending) setHold(ending);
    else setShown(snapshot);
  }

  useEffect(() => {
    if (!hold) return;
    const timer = setTimeout(
      () => {
        // Releasing ADOPTS the snapshot the hold deferred, in the same commit
        // that clears the hold. Clearing alone would re-enter it forever: the
        // condition that started it is a fact about `shown`, which would not
        // have moved.
        setShown(hold.next);
        setHold(null);
      },
      hold.kind === 'reveal' ? FINAL_REVEAL_HOLD_MS : FINAL_ANSWER_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [hold]);

  const skipToScores = useCallback(() => {
    if (!hold) return;
    setShown(hold.next);
    setHold(null);
  }, [hold]);

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
  /** WHO cancelled has no home in the state envelope — a cancelled game reports
   *  that it was cancelled and nothing about by whom — so this is the one fact
   *  in the hook that only an event can supply, and the screen says less rather
   *  than guessing when no event arrived. */
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

  /**
   * A game that has reached its end is no longer the channel's live game, and
   * the bar under the channel header is the affordance that would rot: its
   * probe is on a 30-second beat, so without this the chat would keep offering
   * a way into a game that is over. One read, once, on the way out — not a
   * second poll of anything.
   */
  const ended = isTerminalPhase(phase);
  useEffect(() => {
    if (!ended) return;
    void queryClient.invalidateQueries({
      queryKey: channelQuizQueries.activeGameOf(channelUuid),
    });
  }, [ended, channelUuid, queryClient]);

  /**
   * WHAT THE SERVER SAYS THIS READER DID with the question on screen.
   *
   * Two sources of truth, in order of authority: a state read that stamped
   * `your_answer`, or the receipt the answer endpoint returned for THIS
   * question (`variables.question` names which one it was for). The locally
   * tapped option is deliberately not one of them — see {@link AnswerStanding}
   * for the two ways that would put a false claim on screen.
   */
  const submissionQuestion = answerMutation.variables?.question ?? null;
  const answerStanding = readAnswerStanding(shown?.your_answer?.option_id ?? null, {
    mine: submissionQuestion !== null && submissionQuestion === questionUuid,
    isPending: answerMutation.isPending,
    receiptOptionId: answerMutation.data?.data.option_id ?? null,
    errorStatus: answerMutation.isError
      ? extractApiError(answerMutation.error).status
      : null,
  });

  // The closing card judges the SAME question this standing is about: the hold
  // keeps `shown` on it, so the two can never drift apart.
  const closingQuestion = hold?.kind === 'final-answer' ? hold.question : null;
  const closingAnswer: FinalAnswerClose | null =
    closingQuestion === null
      ? null
      : { question: closingQuestion, standing: answerStanding };

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
    // A failed REFETCH keeps `data` (React Query v5 sets `status: 'error'`
    // beside it), so this is the difference between "we cannot show you the
    // game" and "the game is right here and one read of it failed".
    readFailing: query.isError && shown !== null,
    retry: () => void query.refetch(),

    state: shown,
    phase,
    holdingFinalReveal: hold?.kind === 'reveal',
    closingAnswer,
    skipToScores,

    isHost: shown ? isHostOf(shown, viewerUuid) : false,
    isPlaying: shown ? isPlayingIn(shown, viewerUuid) : false,

    pendingOptionId,
    answerStanding,
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
