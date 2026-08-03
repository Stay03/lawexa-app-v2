'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quizApi } from '@/lib/api/quiz';
import type {
  QuizSessionResponse,
  StartQuizSessionData,
  SubmitQuizAnswerData,
} from '@/types/quiz';
import { useV2Session } from '@/v2/runtime/session-context';
import { quizQueries } from './queries';

/**
 * mutations.ts — THE quiz write layer. Ports the cache logic proven in
 * `lib/hooks/useQuiz.ts` (which v2 may not import — `lib/hooks` is
 * boundary-blocked) onto the v2 keys, and nothing else changes about it: the
 * three writes and their cache consequences are the same three v1 ships.
 *
 * ── WHY THESE ARE HAND-ROLLED AND NOT `patchingMutation` ────────────────────
 * The shared helper in `v2/runtime/mutations.ts` patches ONE fixed `queryKey`
 * with the server response. Each of these three needs something it cannot
 * express:
 *
 *   start   the key to seed is derived from the RESPONSE (the new session's
 *           uuid), so it cannot be named up front;
 *   answer  must `cancelQueries` first — the session leaf is on the `live`
 *           tier (staleTime 0), so a focus refetch can be on the wire while a
 *           submit resolves, and without the cancel that stale response could
 *           land last and put the ALREADY-ANSWERED question back on screen;
 *   end     writes nothing — it only invalidates.
 *
 * ── THE FEEDBACK SPLIT ──────────────────────────────────────────────────────
 * `end` rides the global `MutationCache.onError` toast (standards §2 — the one
 * error channel). `start` and `answer` opt out with `meta.silentError` because
 * their failures are not generic: a 403 on start means "verify your email" and
 * a 409 on answer means "this session already ended, here are your results" —
 * both are call-site NAVIGATIONS with their own copy, and a generic toast on
 * top of them would double-report. Every call site that opts out MUST report
 * its own failure; see `PlayerScreen` / `QuizHubScreen`.
 *
 * Always `mutate`, never `mutateAsync` (standards §2).
 */

/**
 * Start a new session, or resume the open one — the canonical "open quiz"
 * action (`POST /quizzes` is start-or-resume; the backend allows exactly one
 * active session per user).
 *
 * The response already carries the session AND its first served question, so
 * it is seeded straight into the session cache: the player route then paints
 * from cache on arrival instead of re-fetching what we were just handed. The
 * session LISTS are invalidated through the global meta channel — a new row
 * exists, and the hub's "Resume" hero depends on it.
 */
export function useStartQuizSession() {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  return useMutation({
    mutationFn: (data: StartQuizSessionData = {}) => quizApi.startSession(data),
    meta: {
      invalidates: [quizQueries.sessions()],
      // 403 = unverified email, which the hub renders as a designed panel.
      silentError: true,
    },
    onSuccess: (response) => {
      queryClient.setQueryData(
        quizQueries.session(response.data.session.uuid, { viewerId }).queryKey,
        response,
      );
    },
  });
}

/**
 * Submit the current question's answer.
 *
 * The response carries the updated live score AND the next served question, so
 * it is written straight onto the session key — the play loop never round-trips
 * for the next question, and a mid-session reload is seamless because the cache
 * already holds exactly what `GET /quizzes/{uuid}` would return.
 *
 * DELIBERATELY NOT INVALIDATING THE LISTS on every answer (v1's call, kept):
 * that would fire a `/quizzes` request per question for a counter nobody is
 * looking at. The lists carry `REFETCH_ON_VISIT`, so they self-correct the
 * moment the user actually arrives at one.
 */
export function useSubmitQuizAnswer(sessionUuid: string) {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();
  const sessionKey = quizQueries.session(sessionUuid, { viewerId }).queryKey;

  return useMutation({
    mutationFn: (data: SubmitQuizAnswerData) =>
      quizApi.submitAnswer(sessionUuid, data),
    // One session, one answer at a time — a burst of taps can never interleave.
    scope: { id: `quiz-answer-${sessionUuid}` },
    // 409 (session ended underneath us) is a navigation, not a toast.
    meta: { silentError: true },
    onMutate: async () => {
      // See the module docblock: the `live` tier means a refetch can be in
      // flight; cancel it so it cannot land after our write.
      await queryClient.cancelQueries({ queryKey: sessionKey });
    },
    onSuccess: (response: QuizSessionResponse) => {
      queryClient.setQueryData(sessionKey, response);
    },
  });
}

/**
 * End the session and finalize the score (idempotent server-side).
 *
 * Invalidates the session LISTS (status + score changed), the STATS (this
 * session now counts toward every aggregate) and any cached RESULTS for it, so
 * the review screen reads the finalized payload rather than a pre-end 409.
 *
 * The session KEY is deliberately left alone. Invalidating it would refetch the
 * play state the caller is in the middle of navigating away from, and the
 * refetch could resolve first and flash the "this session has ended" panel over
 * the player. It costs nothing to skip: the leaf is on the `live` tier, so a
 * later visit to the same session refetches on mount anyway.
 */
export function useEndQuizSession(sessionUuid: string) {
  const { userId: viewerId } = useV2Session();

  return useMutation({
    mutationFn: () => quizApi.endSession(sessionUuid),
    meta: {
      invalidates: [
        quizQueries.sessions(),
        quizQueries.stats({ viewerId }).queryKey,
        quizQueries.results(sessionUuid, { viewerId }).queryKey,
      ],
    },
  });
}
