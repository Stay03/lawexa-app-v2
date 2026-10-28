'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { quizAttemptsApi } from '@/lib/api/channel-quiz';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  QuizAttemptResponse,
  QuizRevealMode,
  SubmitQuizAttemptAnswerPayload,
} from '@/types/channel-quiz';
import { withAnswer } from './model';
import { soloQuizQueries } from './queries';

/**
 * solo quiz mutations — the three moves of an attempt: start, answer, finish.
 *
 * Source: backend branch quiz-part1-publish-and-solo (tip 45a8f711),
 * 21 October 2026. The AUTHORING writes (create, update, visibility, delete)
 * are the channel quiz's own (`channels/quiz/mutations.ts`) and already settle
 * every list the solo surfaces read; nothing here duplicates them.
 *
 * EVERY MUTATION IS `silentError`. An attempt's refusals are rules with a
 * designed answer on the screen that met them — a `409` means the server
 * already has this answer or has already scored the attempt, and the honest
 * reaction is to re-read the attempt and draw what it says, not to toast a
 * status code over a question. A failure with no response is said in place,
 * under the options, by the player.
 *
 * NO OPTIMISM ON THE ANSWER. The server is the referee: an answer that looked
 * recorded and was then refused would be a lie about a score. The player locks
 * the tapped tile in local state (instant), and the cache is written from the
 * RECEIPT — which, on an `each` attempt, is also the reveal.
 */

/**
 * Start an attempt on a quiz with the chosen reveal mode. `201` returns the
 * attempt in full, so it is seeded straight onto the attempt key: the player
 * route paints from cache on arrival instead of re-fetching what it was just
 * handed. `401` is a visitor and `403` a guest pass; the quiz front never
 * offers Start to either.
 */
export function useStartAttempt(quizUuid: string, viewerId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reveal_mode: QuizRevealMode) =>
      quizAttemptsApi.start(quizUuid, { reveal_mode }),
    meta: { silentError: true },
    onSuccess: (response) => {
      queryClient.setQueryData<QuizAttemptResponse>(
        soloQuizQueries.attempt(response.data.uuid, { viewerId }).queryKey,
        response,
      );
    },
  });
}

/**
 * Record one answer.
 *
 * THE RECEIPT IS WRITTEN ONTO THE ATTEMPT (`withAnswer`, `./model.ts`): the
 * question becomes `answered` with the viewer's option, and on an `each`
 * attempt gains its verdict — which is exactly what `GET` on the attempt
 * would now return, so a reload after the write resumes on the same screen.
 *
 * A `409` IS AN ANSWER THE SERVER ALREADY HAS, OR AN ATTEMPT IT HAS ALREADY
 * SCORED ("This question has already been answered." / "This attempt is
 * already finished." — same status, two sentences, never string-matched). Both
 * are settled the same way: the attempt is re-read, and the player draws what
 * comes back — the question's own verdict in the first case, the results in
 * the second.
 *
 * `scope` keeps one answer in flight per attempt, so a burst of taps can never
 * interleave two writes to one question. The attempt read in flight is
 * cancelled first: the key sits on the live tier, so a focus refetch could
 * otherwise land after the write and put the question back a step.
 */
export function useAnswerAttempt(attemptUuid: string, viewerId: number | null) {
  const queryClient = useQueryClient();
  const attemptKey = soloQuizQueries.attempt(attemptUuid, { viewerId }).queryKey;
  return useMutation({
    mutationFn: (payload: SubmitQuizAttemptAnswerPayload) =>
      quizAttemptsApi.answer(attemptUuid, payload),
    scope: { id: `quiz-attempt-answer:${attemptUuid}` },
    meta: { silentError: true },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: attemptKey });
    },
    onSuccess: (response, payload) => {
      queryClient.setQueryData<QuizAttemptResponse>(attemptKey, (current) =>
        current ? withAnswer(current, payload, response.data) : current,
      );
    },
    onError: (error) => {
      if (extractApiError(error).status === 409) {
        void queryClient.invalidateQueries({ queryKey: attemptKey });
      }
    },
  });
}

/**
 * Score the attempt. The body is the finished attempt in full, written onto
 * the same key, so the results route paints from cache the moment it mounts.
 * Unanswered questions count as wrong — the player says so before asking.
 */
export function useFinishAttempt(attemptUuid: string, viewerId: number | null) {
  const queryClient = useQueryClient();
  const attemptKey = soloQuizQueries.attempt(attemptUuid, { viewerId }).queryKey;
  return useMutation({
    mutationFn: () => quizAttemptsApi.finish(attemptUuid),
    meta: { silentError: true },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: attemptKey });
    },
    onSuccess: (response) => {
      queryClient.setQueryData<QuizAttemptResponse>(attemptKey, response);
      // The finish writes the reader's board row at once (Backend), so the
      // results read the board fresh rather than a copy from the quiz page.
      void queryClient.invalidateQueries({ queryKey: soloQuizQueries.leaderboardOf(response.data.quiz.uuid) });
    },
    onError: (error) => {
      // Already finished elsewhere (a second tab): the re-read carries the
      // score, and the player sends the reader to it.
      if (extractApiError(error).status === 409) {
        void queryClient.invalidateQueries({ queryKey: attemptKey });
      }
    },
  });
}
