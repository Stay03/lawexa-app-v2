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
  ChannelQuizVisibility,
  CreateChannelQuizPayload,
  QuizGameStateResponse,
  SubmitQuizAnswerPayload,
  UpdateChannelQuizPayload,
} from '@/types/channel-quiz';
import { noteThrottled } from '../engagement-throttle';
import { isQuizListQuery, withVisibility, type QuizListCacheEntry } from './list-cache';
import { channelQuizQueries } from './queries';
import { goLivePayload, type QuizRoom } from './quiz-room';

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
 * A WRITE TO ONE QUIZ CAN CHANGE FOUR LISTS. Since 2026-08-05 a quiz is the
 * author's and merely RUNS in rooms, so the same row appears on the reader's
 * library and on the list of every channel it has been played in — and since
 * 2026-10-21 on the solo library page and, when public, on the explore list.
 * Every authoring write therefore settles all of them, and the room list is
 * settled across ALL channels rather than only the one the sheet was opened in
 * — a quiz that has travelled is on more lists than the caller can name. The
 * predicate (`./list-cache.ts`) names the row lists and never the live game or
 * an attempt in play.
 */
function invalidateQuizLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: isQuizListQuery,
  });
}

/**
 * Write a quiz FOR a channel. The room rides the variables rather than the
 * hook (2026-10-21): the form that calls this now opens outside any channel
 * too, and a hook that took the room up front would have had to be given an
 * empty string there.
 */
export function useCreateQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      channelUuid,
      payload,
    }: {
      channelUuid: string;
      payload: CreateChannelQuizPayload;
    }) => channelQuizApi.create(channelUuid, payload),
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
    onSuccess: (response) => {
      invalidateQuizLists(queryClient);
      // The saved quiz, as the server now holds it, before the refetch lands. A
      // save rebuilds the questions with new uuids, and the form sends each
      // question's uuid back so the server keeps its source (backend, 24 October
      // 2026): a form opened again from the old copy would send the old uuids,
      // and the sources would go.
      queryClient.setQueriesData({ queryKey: channelQuizQueries.quizDetailOf(quizUuid) }, response);
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

      // Flat pages and page-infinite entries alike — `withVisibility` reads
      // the shape before the rows (`./list-cache.ts`).
      const snapshot: [QueryKey, QuizListCacheEntry][] = [];
      for (const [queryKey, rows] of queryClient.getQueriesData<QuizListCacheEntry>(
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

export function useDeleteQuiz(quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelQuizApi.remove(quizUuid),
    meta: { silentError: true },
    onSuccess: () => {
      // Marked stale, not removed: the quiz front is still mounted when this
      // runs (it leaves for the library just after), and a removed entry with
      // a mounted reader refetches at once and paints "couldn't find this
      // quiz" for a beat (checker, 22 October 2026). Nothing reads the stale
      // entry after the front leaves, and gc drops it.
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.quizDetailOf(quizUuid),
        refetchType: 'none',
      });
      invalidateQuizLists(queryClient);
    },
  });
}

/* ── Game moves ───────────────────────────────────────────────────────────── */

/** Where one Go live runs: a room, and for a Space the chat it starts from. */
export interface GoLiveTarget {
  room: QuizRoom;
  conversationUuid?: string | null;
}

/**
 * Put a quiz live IN A ROOM (a channel, or a Space itself): `201` a lobby
 * with the host auto-joined, `409` when the room already has a live game (the
 * library surfaces that as "a quiz is already running here" with a link INTO
 * it, not as an error), `403` when the reader may not host there.
 *
 * The room comes with each press (`GoLiveTarget`): the sheet's own room, or
 * the Space the reader picked from outside one (`HostLiveQuizDialog`). The body
 * is the room's own (`goLivePayload` in `./quiz-room.ts`): the room stated
 * outright, and for a Space the chat it was started from.
 *
 * IT ALSO SETTLES THE LISTS. A library quiz that runs in a channel joins its
 * "quizzes that have been here" list the moment its game exists, so the sheet
 * the reader just pressed the button in is already out of date.
 */
export function useGoLive(quizUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ room, conversationUuid = null }: GoLiveTarget) =>
      channelQuizApi.goLive(quizUuid, goLivePayload(room, conversationUuid)),
    meta: { silentError: true },
    onSuccess: (_response, { room }) => {
      // The probe every quiz card and live bar in the room reads.
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.activeGameOf(room),
      });
      invalidateQuizLists(queryClient);
    },
    onError: (error, { room }) => {
      // A 409 IS the probe answering: someone else's game started between our
      // last beat and this press. The refusal tells the reader to open the game
      // above it, so the banner has to be there when they look — waiting out
      // the probe's 30-second beat would point at a row that does not exist
      // yet. No other status implies a game, so nothing else refetches.
      if (extractApiError(error).status === 409) {
        void queryClient.invalidateQueries({
          queryKey: channelQuizQueries.activeGameOf(room),
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
  room?: QuizRoom,
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
      if (room) {
        void queryClient.invalidateQueries({
          queryKey: channelQuizQueries.activeGameOf(room),
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

/** Host or room governance. A cancelled game leaves no results and posts no
 *  chat card, so the screen tears down quietly and hands the reader back. */
export function useCancelGame(gameUuid: string, viewerId: number | null, room: QuizRoom) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => quizGamesApi.cancel(gameUuid),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.gameStateOf(gameUuid),
      });
      void queryClient.invalidateQueries({
        queryKey: channelQuizQueries.activeGameOf(room),
      });
    },
  });
}

/**
 * The game's link into its Space (live quiz in Spaces, 7a007a8c): made on the
 * first ask, the same link after. Nothing is cached around it: the dialog that
 * shows it asks each time it opens, which costs one idempotent request and
 * never shows a link the server has since let lapse.
 */
export function useGameInviteLink(gameUuid: string) {
  return useMutation({
    mutationFn: () => quizGamesApi.inviteLink(gameUuid),
    meta: { silentError: true },
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
