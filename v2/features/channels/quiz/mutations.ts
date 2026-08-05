'use client';

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

import { channelQuizApi, quizGamesApi } from '@/lib/api/channel-quiz';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  ChannelQuizListResponse,
  ChannelQuizVisibility,
  CreateChannelQuizPayload,
  GoLiveChannelQuizPayload,
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
 *
 * ONE MUTATION IS OPTIMISTIC, AND IT EARNED IT: {@link useSetQuizVisibility}.
 * See its docblock for why that one is different from every other write here.
 */

/* ── Authoring ────────────────────────────────────────────────────────────── */

/**
 * A WRITE TO ONE QUIZ CAN CHANGE TWO LISTS. Since 2026-08-05 a quiz is the
 * author's and merely RUNS in rooms, so the same row appears on the reader's
 * library and on the list of every channel it has been played in. Every
 * authoring write therefore settles both, and the room list is settled across
 * ALL channels rather than only the one the sheet was opened in — a quiz that
 * has travelled is on more lists than the caller can name.
 */
function invalidateQuizLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: isQuizListQuery,
  });
}

/** True for the room lists and the library, and for nothing else under the
 *  `channel-quiz` root — never the live game state, whose poll is this
 *  feature's transport and must not be disturbed by an authoring write. */
function isQuizListQuery(query: { queryKey: QueryKey }): boolean {
  const [root, kind] = query.queryKey;
  return root === 'channel-quiz' && (kind === 'quizzes' || kind === 'my-quizzes');
}

export function useCreateQuiz(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChannelQuizPayload) =>
      channelQuizApi.create(channelUuid, payload),
    meta: { silentError: true },
    onSuccess: () => invalidateQuizLists(queryClient),
  });
}

/**
 * The same create with no room attached — the quiz lands in the author's
 * library and stays there until they point it at a channel. The sheet offers
 * this from its Library tab, where the destination is what the tab MEANS.
 */
export function useCreateLibraryQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChannelQuizPayload) =>
      channelQuizApi.createInLibrary(payload),
    meta: { silentError: true },
    onSuccess: () => invalidateQuizLists(queryClient),
  });
}

/**
 * Patch a quiz. A `questions` array is a FULL replacement and the server
 * refuses it with `409` once the quiz has real plays — the form catches that
 * status and offers to save the metadata alone, which always succeeds.
 */
export function useUpdateQuiz(quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateChannelQuizPayload) =>
      channelQuizApi.update(quizUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      invalidateQuizLists(queryClient);
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.quizDetailOf(quizUuid),
      });
    },
  });
}

/**
 * Who can FIND this quiz. Owner only, and the one write in this module that
 * paints before the server answers.
 *
 * WHY THIS ONE IS OPTIMISTIC WHEN NOTHING ELSE IS. It is a two-state switch
 * inside a menu that closes the instant it is pressed, so there is nowhere left
 * to put a spinner — the only feedback available is the row itself. Waiting for
 * the round trip would leave the row saying the opposite of what the reader just
 * chose for as long as the network takes. And unlike an answer or a go-live,
 * being wrong here costs nothing that cannot be taken back: no score depends on
 * it, no game state moves, and the field can be changed again a second later.
 *
 * THE ROLLBACK IS REAL, not a re-fetch. `onMutate` snapshots every cached list
 * entry the quiz actually appears in, patches those, and `onError` puts the
 * snapshots back verbatim — so a refused write leaves the cache byte-identical
 * to before it, even for lists whose queries have no observer and would never
 * refetch. `onSettled` then reconciles with the server either way.
 *
 * Untouched entries keep their object identity (see {@link withVisibility}), so
 * a patch re-renders only the lists that contain the row.
 *
 * ── AND IT IS SCOPED, WHICH THE SNAPSHOT PROTOCOL DEPENDS ON ───────────────
 * `scope` makes writes to the SAME quiz run one at a time. Without it, two
 * toggles in quick succession would each snapshot and each restore
 * independently: the second would snapshot a cache the first had already
 * patched, and a first attempt that failed AFTER the second succeeded would put
 * back a picture taken before it — the row showing the value the reader
 * abandoned. `onSettled`'s invalidate did eventually correct that, which is why
 * it was only ever a flicker, but a rollback that restores the wrong state is
 * not something to leave resting on a refetch.
 *
 * THE COST IS NAMED. A queued write does not run `onMutate` until the one ahead
 * of it settles, so the SECOND of two rapid toggles paints one round trip late
 * rather than instantly. That window is exactly the window in which the bug it
 * removes could occur, and reaching it means re-opening a menu that closes on
 * every press — so the trade buys a correct-by-construction rollback for a lag
 * almost nobody can produce. The id is per QUIZ, so two different rows still
 * toggle in parallel.
 */
export function useSetQuizVisibility(quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (visibility: ChannelQuizVisibility) =>
      channelQuizApi.update(quizUuid, { visibility }),
    scope: { id: `channel-quiz-visibility:${quizUuid}` },
    meta: { silentError: true },
    onMutate: async (visibility) => {
      // Scoped by predicate, never by the feature root: cancelling everything
      // under `channel-quiz` would abort the live game's in-flight state read,
      // which is both this feature's transport and its recovery.
      await queryClient.cancelQueries({ predicate: isQuizListQuery });

      const snapshot: [QueryKey, ChannelQuizListResponse][] = [];
      for (const [queryKey, rows] of queryClient.getQueriesData<ChannelQuizListResponse>(
        { predicate: isQuizListQuery },
      )) {
        if (!rows) continue;
        const patched = withVisibility(rows, quizUuid, visibility);
        if (patched === rows) continue;
        snapshot.push([queryKey, rows]);
        queryClient.setQueryData(queryKey, patched);
      }
      return { snapshot };
    },
    onError: (_error, _visibility, context) => {
      for (const [queryKey, rows] of context?.snapshot ?? []) {
        queryClient.setQueryData(queryKey, rows);
      }
    },
    onSettled: () => {
      invalidateQuizLists(queryClient);
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.quizDetailOf(quizUuid),
      });
    },
  });
}

/** One list page with one quiz's `visibility` rewritten — and the SAME object
 *  back when the row is absent or already says this, so an untouched cache
 *  entry cannot re-render anything. */
function withVisibility(
  rows: ChannelQuizListResponse,
  quizUuid: string,
  visibility: ChannelQuizVisibility,
): ChannelQuizListResponse {
  let touched = false;
  const data = rows.data.map((quiz) => {
    if (quiz.uuid !== quizUuid || quiz.visibility === visibility) return quiz;
    touched = true;
    return { ...quiz, visibility };
  });
  return touched ? { ...rows, data } : rows;
}

export function useDeleteQuiz(quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelQuizApi.remove(quizUuid),
    meta: { silentError: true },
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: channelQuizQueries.quizDetailOf(quizUuid),
      });
      invalidateQuizLists(queryClient);
    },
  });
}

/* ── Game moves ───────────────────────────────────────────────────────────── */

/**
 * Put a quiz live IN THIS CHANNEL: `201` a lobby with the host auto-joined,
 * `409` when the channel already has a live game (the library surfaces that as
 * "a quiz is already running here" with a link INTO it, not as an error), `403`
 * when the host policy refuses.
 *
 * The caller passes the body, built by `goLiveTarget` in `./model.ts` — the
 * room is always `channelUuid`, and the payload only differs in shape.
 *
 * IT ALSO SETTLES THE LISTS. A library quiz that runs here joins this channel's
 * "quizzes that have been here" list the moment its game exists, so the sheet
 * the reader just pressed the button in is already out of date.
 */
export function useGoLive(channelUuid: string, quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GoLiveChannelQuizPayload) =>
      channelQuizApi.goLive(quizUuid, payload),
    meta: { silentError: true },
    onSuccess: () => {
      // The probe every quiz card in the feed reads — one entry per channel.
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.activeGameOf(channelUuid),
      });
      invalidateQuizLists(queryClient);
    },
    onError: (error) => {
      // A 409 IS the probe answering: someone else's game started between our
      // last beat and this press. The refusal tells the reader to open the game
      // above it, so the banner has to be there when they look — waiting out
      // the probe's 30-second beat would point at a row that does not exist
      // yet. No other status implies a game, so nothing else refetches.
      if (extractApiError(error).status === 409) {
        void queryClient.invalidateQueries({
          queryKey: channelQuizQueries.activeGameOf(channelUuid),
        });
      }
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
