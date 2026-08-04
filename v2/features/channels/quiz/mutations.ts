'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { channelQuizApi, quizGamesApi } from '@/lib/api/channel-quiz';
import type {
  CreateChannelQuizPayload,
  QuizGameStateResponse,
  SubmitQuizAnswerPayload,
  UpdateChannelQuizPayload,
} from '@/types/channel-quiz';
import { noteThrottled } from '../engagement-throttle';
import { channelQuizQueries } from './queries';

/**
 * channel-quiz mutations — authoring writes and the four game moves (go live,
 * join, start, answer, cancel).
 *
 * Sources: `docs/api/channel-quiz.md` (backend repo), `api-digest.md` §C/§E —
 * phase-5 W6, 2026-08-04.
 *
 * EVERY MUTATION IS `silentError`, WITHOUT EXCEPTION. This feature's refusals
 * are not failures, they are RULES, and each one has a designed state that
 * explains it in place:
 *  - `409` on go-live  — another game is already live in this channel;
 *  - `409` on answer   — the question closed, moved on, or you already answered;
 *  - `409` on edit     — the quiz has been played, so its questions are frozen;
 *  - `403` on join     — late joining is off for this quiz;
 *  - `403` on authoring— the channel's host policy is admins-only.
 * A toast for any of these would interrupt a running game to state a rule the
 * screen is already showing. (Design-research DIRECTION 6: the only justified
 * toast family is actionable failures — and none of these are.)
 *
 * OPTIMISM IS DELIBERATELY ABSENT FROM THE GAME MOVES. The server is the
 * referee: an answer that "looks" accepted and is then refused would be a lie
 * about a score. The screen locks the reader's PICK the instant they tap it
 * (local state, so the interaction is instant), and every authoritative fact —
 * accepted, correct, points — comes back from the server.
 */

/* ── Authoring ────────────────────────────────────────────────────────────── */

export function useCreateQuiz(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChannelQuizPayload) =>
      channelQuizApi.create(channelUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.quizzesOf(channelUuid),
      });
    },
  });
}

/**
 * Patch a quiz. A `questions` array is a FULL replacement and the server
 * refuses it with `409` once the quiz has real plays — the form catches that
 * status and offers to save the metadata alone, which always succeeds.
 */
export function useUpdateQuiz(channelUuid: string, quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateChannelQuizPayload) =>
      channelQuizApi.update(quizUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.quizzesOf(channelUuid),
      });
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.quizDetailOf(quizUuid),
      });
    },
  });
}

export function useDeleteQuiz(channelUuid: string, quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelQuizApi.remove(quizUuid),
    meta: { silentError: true },
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: channelQuizQueries.quizDetailOf(quizUuid),
      });
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.quizzesOf(channelUuid),
      });
    },
  });
}

/* ── Game moves ───────────────────────────────────────────────────────────── */

/**
 * Put a quiz live: `201` a lobby with the host auto-joined, `409` when the
 * channel already has a live game (the library surfaces that as "a quiz is
 * already running here" with a link INTO it, not as an error).
 */
export function useGoLive(channelUuid: string, quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelQuizApi.goLive(quizUuid),
    meta: { silentError: true },
    onSuccess: () => {
      // The probe every quiz card in the feed reads — one entry per channel.
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.activeGameOf(channelUuid),
      });
    },
  });
}

/**
 * The three moves that return the FULL state envelope (`join`, `start`) get
 * their answer written straight onto the game's key: the response IS the
 * authoritative snapshot, so waiting for the next poll to show a lobby the
 * server has already confirmed would be a pointless beat of latency.
 */
function useEnvelopeMove(
  gameUuid: string,
  viewerId: number | null,
  run: () => Promise<QuizGameStateResponse>,
  channelUuid?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    meta: { silentError: true },
    onSuccess: (response) => {
      queryClient.setQueryData<QuizGameStateResponse>(
        channelQuizQueries.gameState({ gameUuid, viewerId }).queryKey,
        response,
      );
      if (channelUuid) {
        void queryClient.invalidateQueries({
          queryKey: channelQuizQueries.activeGameOf(channelUuid),
        });
      }
    },
  });
}

/** Idempotent. `403` = late joining is off (a designed "watch only" state),
 *  `409` = the game is already over. */
export function useJoinGame(gameUuid: string, viewerId: number | null) {
  return useEnvelopeMove(gameUuid, viewerId, () => quizGamesApi.join(gameUuid));
}

/** Host only; lobby → the 30-second countdown. `409` if not in lobby. */
export function useStartGame(gameUuid: string, viewerId: number | null) {
  return useEnvelopeMove(gameUuid, viewerId, () => quizGamesApi.start(gameUuid));
}

/** Host or channel governance. A cancelled game leaves no results and posts no
 *  chat card, so the screen tears down quietly and hands the reader back. */
export function useCancelGame(
  gameUuid: string,
  viewerId: number | null,
  channelUuid: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => quizGamesApi.cancel(gameUuid),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.gameStateOf(gameUuid),
      });
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.activeGameOf(channelUuid),
      });
    },
  });
}

/**
 * Submit the one answer this player gets for this question.
 *
 * NOT OPTIMISTIC AGAINST THE CACHE (see the module docblock) — the caller
 * holds the tapped option in local state so the button locks in the same
 * frame, and the receipt/envelope replaces it with the server's truth.
 *
 * THROTTLE: routed through the shared engagement-throttle family
 * (`quiz-answer`), so a 429 quiets the option grid for a beat instead of
 * raising anything. The answer endpoint has no documented per-minute ceiling,
 * but it is a tap target on a live screen and the family already models
 * exactly the right behaviour for "you are going faster than we allow".
 */
export function useSubmitAnswer(gameUuid: string, viewerId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitQuizAnswerPayload) =>
      quizGamesApi.answer(gameUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      // The receipt carries no correctness by contract; the next authoritative
      // read stamps `your_answer` (and, at the reveal, its points).
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.gameState({ gameUuid, viewerId }).queryKey,
      });
    },
    onError: (error) => {
      noteThrottled('quiz-answer', error);
    },
  });
}
