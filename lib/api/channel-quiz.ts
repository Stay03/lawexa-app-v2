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
 * raw errors): 403 membership / host-policy / joined-too-late · 404 unknown
 * uuid · 409 wrong state (a second live game, a stale question, an already
 * answered question, editing a played quiz) · 422 validation.
 */

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  ChannelQuizListParams,
  ChannelQuizListResponse,
  ChannelQuizResponse,
  CreateChannelQuizPayload,
  QuizAnswerResponse,
  QuizGameListResponse,
  QuizGameResponse,
  QuizGameResultsResponse,
  QuizGameStateResponse,
  SubmitQuizAnswerPayload,
  UpdateChannelQuizPayload,
} from '@/types/channel-quiz';

/** Authoring — gated by the channel's `settings.quiz_host_policy`. */
export const channelQuizApi = {
  /** Newest first; rows carry `question_count` and embed no questions. */
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
          mine: params.mine,
        },
      },
    );
    return response.data;
  },

  /** `201` returns the AUTHOR view (options carry `is_correct`). */
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

  /** Full quiz. `is_correct` is present only when the viewer may edit it. */
  show: async (quizUuid: string): Promise<ChannelQuizResponse> => {
    const response = await apiClient.get<ChannelQuizResponse>(
      `/channel-quizzes/${quizUuid}`,
    );
    return response.data;
  },

  /** A `questions` array is a FULL replacement; 409 while live or once played. */
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

  /** `201` the new game in lobby, host auto-joined. 409 if the channel
   *  already has a live game; 403 when the host policy refuses. */
  goLive: async (quizUuid: string): Promise<QuizGameResponse> => {
    const response = await apiClient.post<QuizGameResponse>(
      `/channel-quizzes/${quizUuid}/go-live`,
      {},
    );
    return response.data;
  },
};

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
