/**
 * Channel Quiz (live) — the Kahoot-style group game that runs INSIDE a channel.
 *
 * Mirrors `docs/api/channel-quiz.md` in the backend repo (fetched 2026-08-04),
 * condensed in `docs/v2-docs/phases/phase-5-collab-notifications/api-digest.md`
 * §B (the 8 `.quiz.game.*` events) / §C (endpoints) / §E (lifecycle + gaps).
 *
 * NOT the solo `/quiz` product (`types/quiz.ts`, `/api/quizzes`). The two share
 * a word and nothing else — no shapes, no screens, no code. Kept in its own
 * module rather than appended to `types/collab.ts` for exactly that reason: a
 * self-contained surface with its own contract doc, its own client and its own
 * feature folder.
 *
 * CONVENTIONS THAT BITE (digest §F.4):
 *  - quizzes, questions and games are addressed by `uuid`; OPTIONS use a
 *    numeric `id` that is only meaningful relative to its question;
 *  - `is_correct` rides an option ONLY in author-view authoring responses, and
 *    is NEVER on the wire during play before the reveal — so it is optional
 *    here and a player-side renderer must not reach for it;
 *  - game-clock fields (`countdown_ends_at`, `question_opens_at`,
 *    `question_ends_at`, `opens_at`, `ends_at`, `answered_at`) are ISO-8601
 *    with sub-second precision and are the ONLY timing authority. The server is
 *    the referee; clients render from these and never advance a phase locally.
 */

import type { ItemResponse, LengthAwareResponse, SlimUser } from '@/types/collab';

/******************************************************************************
                              Vocabulary
******************************************************************************/

/** `settings.quiz_host_policy` on the CHANNEL — gates authoring AND go-live.
 *  Unknown values behave as `all_members` (server rule, mirrored client-side). */
export type QuizHostPolicy = 'all_members' | 'admins_only';

export type QuizQuestionType = 'multiple_choice' | 'true_false';

/** `lobby → countdown → question_open ⇄ reveal → finished`, with `cancelled`
 *  terminal from any non-terminal state. */
export type QuizGameStatus =
  | 'lobby'
  | 'countdown'
  | 'question_open'
  | 'reveal'
  | 'finished'
  | 'cancelled';

/** Per-quiz settings, SNAPSHOTTED into each game at go-live (digest §F.17) —
 *  editing the quiz mid-game cannot change the running game's rules. */
export interface ChannelQuizSettings {
  show_leaderboard: boolean;
  allow_late_join: boolean;
}

/******************************************************************************
                              Authoring shapes
******************************************************************************/

export interface QuizOption {
  id: number;
  content: string;
  position: number;
  /** Author view ONLY (creator / channel owner-admin / space governor /
   *  platform admin). Absent for every player-facing payload. */
  is_correct?: boolean;
}

export interface QuizQuestion {
  uuid: string;
  type: QuizQuestionType;
  question: string;
  time_limit_seconds: number;
  position: number;
  options: QuizOption[];
}

export interface ChannelQuiz {
  uuid: string;
  channel_uuid: string;
  title: string;
  description: string | null;
  settings: ChannelQuizSettings;
  creator: SlimUser;
  /** Present on detail (`GET /channel-quizzes/{quiz}`) and create/update. */
  questions?: QuizQuestion[];
  /** Present on index rows (which never embed questions). */
  question_count?: number;
  created_at: string;
  updated_at: string;
}

/** One option in a create/update body. Exactly one per question is `true`. */
export interface QuizOptionInput {
  content: string;
  is_correct: boolean;
}

export interface QuizQuestionInput {
  type: QuizQuestionType;
  question: string;
  time_limit_seconds: number;
  options: QuizOptionInput[];
}

export interface CreateChannelQuizPayload {
  title: string;
  description?: string;
  settings?: Partial<ChannelQuizSettings>;
  questions: QuizQuestionInput[];
}

/** `PUT /channel-quizzes/{quiz}`. A `questions` array is a FULL REPLACEMENT
 *  (new uuids and option ids) and 409s once the quiz has real plays — send the
 *  metadata alone to edit a played quiz. */
export interface UpdateChannelQuizPayload {
  title?: string;
  description?: string;
  settings?: Partial<ChannelQuizSettings>;
  questions?: QuizQuestionInput[];
}

export interface ChannelQuizListParams {
  per_page?: number;
  page?: number;
  /** `1` = only the caller's own quizzes. */
  mine?: 1;
}

/******************************************************************************
                              Game shapes
******************************************************************************/

/** A row of the live leaderboard. In lobby every score is 0 and `rank` is
 *  provisional; ties rank by who reached the score first (server rule). */
export interface QuizGamePlayer {
  rank: number;
  user: SlimUser;
  score: number;
  /** Non-null marks a late joiner: they play from the NEXT question after
   *  this index, so their answerable set is smaller than the question count. */
  joined_at_question_index: number | null;
}

/** The game object — identical everywhere it appears, including the
 *  `.quiz.game.live` event. */
export interface QuizGame {
  uuid: string;
  status: QuizGameStatus;
  channel_uuid: string;
  quiz: { uuid: string; title: string };
  host: SlimUser | null;
  settings: ChannelQuizSettings;
  question_count: number;
  current_question_index: number | null;
  countdown_ends_at: string | null;
  question_opens_at: string | null;
  question_ends_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  /** Leaderboard order in the state envelope. */
  players?: QuizGamePlayer[];
  player_count?: number;
  created_at: string;
}

/** How many players picked each option — reveal only. `content` is present in
 *  the RESULTS envelope's per-question stats, absent in the live payloads. */
export interface QuizOptionCount {
  option_id: number;
  count: number;
  content?: string;
}

/**
 * The question currently on screen. `null` outside the question phases.
 * `correct_option_id` / `option_counts` / `no_answer_count` appear ONLY during
 * the reveal — their presence IS the reveal signal in the envelope.
 */
export interface QuizCurrentQuestion {
  index: number;
  question: QuizQuestion;
  opens_at: string;
  ends_at: string;
  correct_option_id?: number;
  option_counts?: QuizOptionCount[];
  no_answer_count?: number;
}

/** The viewer's own answer to the current question. `is_correct` / `points`
 *  appear ONLY during the reveal — never earlier, by contract. */
export interface QuizYourAnswer {
  option_id: number;
  answered_at: string;
  response_ms: number;
  is_correct?: boolean;
  points?: number;
}

/** `GET /quiz-games/{game}` and `POST /quiz-games/{game}/join` — THE
 *  authoritative state. Missed events are harmless; this always wins. */
export interface QuizGameState {
  game: QuizGame;
  current_question: QuizCurrentQuestion | null;
  your_answer: QuizYourAnswer | null;
}

/** `POST /quiz-games/{game}/answer` — one-shot, immutable, and deliberately
 *  free of correctness (that arrives at the reveal). */
export interface SubmitQuizAnswerPayload {
  question: string;
  option_id: number;
}

export interface QuizAnswerReceipt {
  option_id: number;
  response_ms: number;
}

/******************************************************************************
                              Results
******************************************************************************/

export interface QuizRankingRow {
  rank: number;
  user: SlimUser;
  score: number;
  correct_count: number;
  answered_count: number;
  /** `< question_count` marks a late joiner — their score is out of fewer. */
  answerable_count: number;
  joined_at_question_index: number | null;
}

export interface QuizQuestionStats {
  uuid: string;
  position: number;
  type: QuizQuestionType;
  question: string;
  time_limit_seconds: number;
  correct_option: { id: number; content: string };
  option_counts: QuizOptionCount[];
  no_answer_count: number;
  percent_correct: number;
  avg_correct_response_ms: number | null;
}

/** `GET /quiz-games/{game}/results` — finished games only (409 while running
 *  or cancelled, with distinct messages). */
export interface QuizGameResults {
  game: {
    uuid: string;
    quiz: { uuid: string; title: string };
    host: SlimUser | null;
    started_at: string | null;
    finished_at: string | null;
    player_count: number;
    question_count: number;
  };
  /** Top 3 of `ranking`. */
  podium: QuizRankingRow[];
  ranking: QuizRankingRow[];
  questions: QuizQuestionStats[];
}

/******************************************************************************
                     Realtime payloads (presence room)
******************************************************************************/

/* All eight ride the channel's EXISTING presence room
   `presence-channels.{channelUuid}` — no new subscription — and are custom
   broadcast names, so they are listened for with a LEADING DOT (§F.1). */

export interface QuizGameLivePayload {
  game: QuizGame;
}

export interface QuizPlayerJoinedPayload {
  game_uuid: string;
  user: SlimUser;
  player_count: number;
}

export interface QuizCountdownPayload {
  game_uuid: string;
  countdown_ends_at: string;
  question_count: number;
}

export interface QuizQuestionOpenedPayload {
  game_uuid: string;
  index: number;
  question_count: number;
  /** Player view — its options carry NO `is_correct`. */
  question: QuizQuestion;
  opens_at: string;
  ends_at: string;
}

export interface QuizAnswerProgressPayload {
  game_uuid: string;
  index: number;
  answered_count: number;
  player_count: number;
}

export interface QuizQuestionClosedPayload {
  game_uuid: string;
  index: number;
  correct_option_id: number;
  option_counts: QuizOptionCount[];
  no_answer_count: number;
  is_final: boolean;
  /** Only when the game's snapshotted `settings.show_leaderboard` is on. */
  leaderboard?: QuizGamePlayer[];
}

/** Arrives IMMEDIATELY after the final `question_closed` — the client holds
 *  the last reveal ~3–5s before the podium (documented backend gap, §E). */
export interface QuizFinishedPayload {
  game_uuid: string;
  podium: QuizRankingRow[];
  ranking: QuizRankingRow[];
}

export interface QuizCancelledPayload {
  game_uuid: string;
  /** `null` = the 10-minute idle-lobby auto-cancel. */
  cancelled_by: SlimUser | null;
  status_before: QuizGameStatus;
}

/******************************************************************************
                              Response aliases
******************************************************************************/

export type ChannelQuizListResponse = LengthAwareResponse<ChannelQuiz>;
export type ChannelQuizResponse = ItemResponse<ChannelQuiz>;
export type QuizGameListResponse = LengthAwareResponse<QuizGame>;
export type QuizGameResponse = ItemResponse<QuizGame>;
export type QuizGameStateResponse = ItemResponse<QuizGameState>;
export type QuizAnswerResponse = ItemResponse<QuizAnswerReceipt>;
export type QuizGameResultsResponse = ItemResponse<QuizGameResults>;
