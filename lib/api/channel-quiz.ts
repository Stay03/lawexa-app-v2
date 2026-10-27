/**
 * Channel Quiz (live) REST client — authoring + games.
 *
 * Routes and shapes follow `docs/api/channel-quiz.md` in the backend repo
 * (condensed in `docs/v2-docs/phases/phase-5-collab-notifications/api-digest.md`
 * §C/§E). Like the rest of `lib/api`, every method returns the raw
 * `{ success, message, data, … }` envelope — the axios interceptor does not
 * unwrap it.
 *
 * SEPARATE FROM `lib/api/collab.ts` ON PURPOSE: this is a self-contained
 * feature with its own contract document and its own base paths
 * (`/channels/{c}/quizzes`, `/channel-quizzes/*`, `/channels/{c}/quiz-games`,
 * `/quiz-games/*`), and it has nothing to do with the solo quiz client
 * (`lib/api/quiz.ts`) beyond the word.
 *
 * ERROR VOCABULARY (all four are DESIGNED STATES on the surfaces above, never
 * raw errors): 403 membership / host-policy / joined-too-late / a library quiz
 * asked to go live with no room named / an unknown target room / `public` from
 * an author the server has not verified · 404 unknown uuid, or a private quiz
 * asked for through the public preview · 409 wrong state (a second live game,
 * a stale question, an already answered question, editing a played quiz, an
 * answer to a finished attempt) · 422 validation.
 *
 * THE PUBLIC READS (`explore`, `preview`; 2026-10-21) work with no token at
 * all, and `apiClient` sends none when the store holds none. They are throttled
 * at 60 a minute per address, which no screen here comes near.
 */

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  ChannelQuizListParams,
  ChannelQuizListResponse,
  ChannelQuizResponse,
  CreateChannelQuizPayload,
  GoLiveChannelQuizPayload,
  QuizAnswerResponse,
  QuizAttemptAnswerResponse,
  QuizAttemptResponse,
  QuizGameListResponse,
  QuizGameResponse,
  QuizGameResultsResponse,
  QuizGameStateResponse,
  QuizHomeListResponse,
  QuizLeaderboardResponse,
  QuizListFilters,
  StartQuizAttemptPayload,
  SubmitQuizAnswerPayload,
  SubmitQuizAttemptAnswerPayload,
  UpdateChannelQuizPayload,
} from '@/types/channel-quiz';

/** Only the filters that are set: an empty search or a cleared choice is
 *  not sent, so the request reads the same as one with no filter. */
function listFilterParams(filters: QuizListFilters): QuizListFilters {
  const search = filters.search?.trim();
  return {
    ...(search ? { search } : {}),
    ...(filters.year !== undefined ? { year: filters.year } : {}),
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.topic ? { topic: filters.topic } : {}),
  };
}

/** Authoring — gated by the channel's `settings.quiz_host_policy`. */
export const channelQuizApi = {
  /**
   * "Quizzes that have been HERE" — created in this channel or played in it at
   * least once (the endpoint's meaning changed on 2026-08-05). Newest first;
   * rows carry `question_count` and embed no questions.
   *
   * `visibility` shapes what comes back for OTHER people: a row someone made
   * private drops off everyone's list but its owner's. Nothing needs to be sent
   * for that — the server already knows who is asking.
   */
  getList: async (
    channelUuid: string,
    params: ChannelQuizListParams = {},
  ): Promise<ChannelQuizListResponse> => {
    const response = await apiClient.get<ChannelQuizListResponse>(
      `/channels/${channelUuid}/quizzes`,
      {
        params: {
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        },
      },
    );
    return response.data;
  },

  /** THE READER'S OWN LIBRARY — every quiz they authored, wherever it was born
   *  and wherever it has been played. Paginated, newest first. */
  getMine: async (
    params: ChannelQuizListParams & QuizListFilters = {},
  ): Promise<QuizHomeListResponse> => {
    const response = await apiClient.get<QuizHomeListResponse>(
      '/channel-quizzes/mine',
      {
        params: {
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
          ...listFilterParams(params),
        },
      },
    );
    return response.data;
  },

  /**
   * EVERY PUBLIC QUIZ — the explore list (2026-10-21). Works signed out, where
   * every row reads `is_mine: false`; rows carry `question_count` and embed no
   * questions. `per_page` 1–50, server default 15.
   */
  explore: async (
    params: ChannelQuizListParams & QuizListFilters = {},
  ): Promise<QuizHomeListResponse> => {
    const response = await apiClient.get<QuizHomeListResponse>(
      '/channel-quizzes/explore',
      {
        params: {
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
          ...listFilterParams(params),
        },
      },
    );
    return response.data;
  },

  /**
   * THE LEADERBOARD of a quiz on the public list (Backend, quiz list part 6):
   * its first `limit` players (server default 20, at most 100) and the
   * reader's own place. Works signed out, where each player is a name and a
   * face only. Any quiz not on the public list is `404`.
   */
  leaderboard: async (quizUuid: string, limit = 20): Promise<QuizLeaderboardResponse> => {
    const response = await apiClient.get<QuizLeaderboardResponse>(
      `/channel-quizzes/${quizUuid}/leaderboard`,
      { params: { limit } },
    );
    return response.data;
  },

  /**
   * A `link` or `public` quiz for anyone, signed in or not, and NEVER with
   * `is_correct` on an option. Everything else — a private quiz, a `shared`
   * one, an unknown uuid — is the same `404`, so this cannot be used to probe
   * which uuids exist. The read for a visitor and a guest; an account reads
   * {@link channelQuizApi.show}, which also says whether the quiz is theirs.
   */
  preview: async (quizUuid: string): Promise<ChannelQuizResponse> => {
    const response = await apiClient.get<ChannelQuizResponse>(
      `/channel-quizzes/${quizUuid}/preview`,
    );
    return response.data;
  },

  /** `201` returns the AUTHOR view (options carry `is_correct`). Stamps this
   *  channel as the quiz's provenance — the right call when the quiz is FOR
   *  that room. */
  create: async (
    channelUuid: string,
    payload: CreateChannelQuizPayload,
  ): Promise<ChannelQuizResponse> => {
    const response = await apiClient.post<ChannelQuizResponse>(
      `/channels/${channelUuid}/quizzes`,
      payload,
    );
    return response.data;
  },

  /** The same create with NO room: `201` with `channel_uuid: null`, the quiz
   *  filed in the author's library until they point it at a channel. */
  createInLibrary: async (
    payload: CreateChannelQuizPayload,
  ): Promise<ChannelQuizResponse> => {
    const response = await apiClient.post<ChannelQuizResponse>(
      '/channel-quizzes',
      payload,
    );
    return response.data;
  },

  /** Full quiz. `is_correct` is present only when the viewer may edit it. */
  show: async (quizUuid: string): Promise<ChannelQuizResponse> => {
    const response = await apiClient.get<ChannelQuizResponse>(
      `/channel-quizzes/${quizUuid}`,
    );
    return response.data;
  },

  /** A `questions` array is a FULL replacement; 409 while live or once played.
   *  `visibility` alone is accepted at any time, including mid-game. */
  update: async (
    quizUuid: string,
    payload: UpdateChannelQuizPayload,
  ): Promise<ChannelQuizResponse> => {
    const response = await apiClient.put<ChannelQuizResponse>(
      `/channel-quizzes/${quizUuid}`,
      payload,
    );
    return response.data;
  },

  /** Soft delete; 409 while its game is live. */
  remove: async (quizUuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/channel-quizzes/${quizUuid}`,
    );
    return response.data;
  },

  /**
   * `201` the new game in lobby, host auto-joined. 409 if the target channel
   * already has a live game; 403 when the host policy refuses, when a library
   * quiz is asked to go live with no room named, or when the named room is
   * unknown (the same status on purpose — the endpoint will not confirm which
   * uuids exist).
   *
   * The payload names WHERE. Callers build it from the room they are standing
   * in, never from the quiz's own `channel_uuid` — that field is provenance.
   */
  goLive: async (
    quizUuid: string,
    payload: GoLiveChannelQuizPayload = {},
  ): Promise<QuizGameResponse> => {
    const response = await apiClient.post<QuizGameResponse>(
      `/channel-quizzes/${quizUuid}/go-live`,
      payload,
    );
    return response.data;
  },
};

/**
 * Solo attempts (2026-10-21) — one person, one quiz, their own clock.
 *
 * THE SERVER KEEPS THE SCORE AND THE APP KEEPS THE TIME. An attempt is a row
 * the server owns: which questions are answered, with what, and (once
 * finished) the score. The timer is the app's: there is no `opens_at` on the
 * wire, the server clamps whatever `response_ms` arrives and never refuses a
 * late answer, so "time's up" is a rule this client enforces on its own
 * screen. A reload mid-question therefore restarts that question's clock — a
 * known soft spot, named in the solo quiz report.
 */
export const quizAttemptsApi = {
  /** `201` a fresh attempt with every question `answered: false`. `401`
   *  signed out, `403` a guest pass. */
  start: async (
    quizUuid: string,
    payload: StartQuizAttemptPayload,
  ): Promise<QuizAttemptResponse> => {
    const response = await apiClient.post<QuizAttemptResponse>(
      `/channel-quizzes/${quizUuid}/attempts`,
      payload,
    );
    return response.data;
  },

  /** THE RESUME — the attempt with the viewer's answers so far, or its score
   *  once finished. Owner only (`404` for anyone else). */
  show: async (attemptUuid: string): Promise<QuizAttemptResponse> => {
    const response = await apiClient.get<QuizAttemptResponse>(
      `/channel-quiz-attempts/${attemptUuid}`,
    );
    return response.data;
  },

  /** One answer per question, once. See {@link SubmitQuizAttemptAnswerPayload}
   *  for the clamp and the two `409`s. */
  answer: async (
    attemptUuid: string,
    payload: SubmitQuizAttemptAnswerPayload,
  ): Promise<QuizAttemptAnswerResponse> => {
    const response = await apiClient.post<QuizAttemptAnswerResponse>(
      `/channel-quiz-attempts/${attemptUuid}/answers`,
      payload,
    );
    return response.data;
  },

  /** Scores the attempt. Unanswered questions count as wrong, and the body is
   *  the finished attempt in full. `409` once it is already finished. */
  finish: async (attemptUuid: string): Promise<QuizAttemptResponse> => {
    const response = await apiClient.post<QuizAttemptResponse>(
      `/channel-quiz-attempts/${attemptUuid}/finish`,
      {},
    );
    return response.data;
  },
};

/* THE PUBLIC SHARE CARD IS NOT HERE, AND MUST NOT COME BACK. Its two readers —
   `app/quiz-results/[gameUuid]/page.tsx` and the OG route beside it — are server
   modules, and this file imports `apiClient`, which pulls the zustand auth store
   and the localStorage device-id helpers into the graph of anything that imports
   it. `GET /public/quiz-games/{game}/results` therefore lives with every other
   server-side read, in `lib/api/server.ts` (`fetchPublicQuizResults`), where its
   docblock also records why it may never carry a session. */

/** Games — one live game per channel; the server owns every clock. */
export const quizGamesApi = {
  /** History, newest first. `active: 1` is the "is a quiz live here?" probe
   *  and returns 0 or 1 rows. */
  getList: async (
    channelUuid: string,
    params: { active?: 1; per_page?: number; page?: number } = {},
  ): Promise<QuizGameListResponse> => {
    const response = await apiClient.get<QuizGameListResponse>(
      `/channels/${channelUuid}/quiz-games`,
      {
        params: {
          active: params.active,
          per_page: params.per_page ?? 20,
          page: params.page ?? 1,
        },
      },
    );
    return response.data;
  },

  /** THE reconnect endpoint — the full, authoritative state envelope. */
  show: async (gameUuid: string): Promise<QuizGameStateResponse> => {
    const response = await apiClient.get<QuizGameStateResponse>(
      `/quiz-games/${gameUuid}`,
    );
    return response.data;
  },

  /** Idempotent; returns the same envelope as `show`. 403 when late join is
   *  off, 409 when the game is already over. */
  join: async (gameUuid: string): Promise<QuizGameStateResponse> => {
    const response = await apiClient.post<QuizGameStateResponse>(
      `/quiz-games/${gameUuid}/join`,
      {},
    );
    return response.data;
  },

  /** Host only — lobby → the 30-second countdown. 409 if not in lobby. */
  start: async (gameUuid: string): Promise<QuizGameStateResponse> => {
    const response = await apiClient.post<QuizGameStateResponse>(
      `/quiz-games/${gameUuid}/start`,
      {},
    );
    return response.data;
  },

  /** One immutable answer per player per question; the receipt carries NO
   *  correctness. 403 not joined / joined too late · 409 nothing open, stale
   *  question, past the deadline, or already answered · 422 foreign option. */
  answer: async (
    gameUuid: string,
    payload: SubmitQuizAnswerPayload,
  ): Promise<QuizAnswerResponse> => {
    const response = await apiClient.post<QuizAnswerResponse>(
      `/quiz-games/${gameUuid}/answer`,
      payload,
    );
    return response.data;
  },

  /** Host, channel owner/admin, space governor or platform admin. A cancelled
   *  game leaves no results and posts no chat card. */
  cancel: async (gameUuid: string): Promise<QuizGameResponse> => {
    const response = await apiClient.post<QuizGameResponse>(
      `/quiz-games/${gameUuid}/cancel`,
      {},
    );
    return response.data;
  },

  /** Finished games only — 409 while running or cancelled. */
  results: async (gameUuid: string): Promise<QuizGameResultsResponse> => {
    const response = await apiClient.get<QuizGameResultsResponse>(
      `/quiz-games/${gameUuid}/results`,
    );
    return response.data;
  },
};
