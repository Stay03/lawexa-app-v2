/**
 * Channel Quiz (live) — the Kahoot-style group game that runs INSIDE a channel.
 *
 * Mirrors `docs/api/channel-quiz.md` in the backend repo (fetched 2026-08-04),
 * condensed in `docs/v2-docs/phases/phase-5-collab-notifications/api-digest.md`
 * §B (the 8 `.quiz.game.*` events) / §C (endpoints) / §E (lifecycle + gaps),
 * plus the round-2 additions of 2026-08-04 (`reply-2026-08-04-spaces-channels-
 * round-2.md` §5: the watchdog, `is_final`, `answers_in`, `next_opens_at`).
 *
 * MEASURED BEATS DOCUMENTED. Every field added in that round was checked against
 * a real production game on 2026-08-04 before it was typed here, because a
 * backend "full X shape" has been wrong before. What the wire actually sent, and
 * what this file therefore encodes:
 *  - `current_question` carries `index`, `is_final`, `next_opens_at`, `opens_at`,
 *    `ends_at`, `answers_in`, `question` in BOTH question phases, and gains
 *    `correct_option_id` / `option_counts` / `no_answer_count` at the reveal;
 *  - `answers_in` is `[]` (never absent) until the first answer lands — on
 *    `GET /quiz-games/{game}`, the one endpoint that was measured; see the
 *    field for why it is nonetheless typed optional;
 *  - `next_opens_at` is `null` while a question is open and an ISO stamp during
 *    a non-final reveal;
 *  - `index` is 0-BASED: `is_final` was `false` on index 0 of a 2-question game
 *    and `true` on index 1. That also settles the question-number base.
 * The event payload additions of the same round could NOT be measured — server
 * broadcasts are not reaching clients in production — so they are typed
 * optional and marked as such.
 *
 * ── 2026-08-05: A QUIZ BELONGS TO A PERSON, AND IS *RUN* IN A CHANNEL ───────
 * The backend split ownership from venue. Every quiz row and detail now carries
 * `channel_uuid` (NULLABLE), `visibility` and `is_mine`; a quiz can be created
 * with no channel at all (`POST /channel-quizzes`), listed as a personal library
 * (`GET /channel-quizzes/mine`), and pointed at a room only at go-live
 * (`POST /channel-quizzes/{quiz}/go-live { channel_uuid }`). MEASURED the same
 * day, and the measurements are what this file encodes:
 *  - the full row key set is `channel_uuid, created_at, creator, description,
 *    is_mine, question_count, settings, title, updated_at, uuid, visibility`
 *    (detail swaps `question_count` for `questions`);
 *  - `GET /channels/{c}/quizzes` CHANGED MEANING — it is now "quizzes that have
 *    been here", created here or played here at least once. A library quiz run
 *    in a channel appears on that channel's list still carrying
 *    `channel_uuid: null`;
 *  - `go-live` with an EMPTY body on a library quiz answers `403`, and with an
 *    unknown `channel_uuid` also `403` (deliberately not `404` — the same
 *    refusal as "you may not host there", so the endpoint cannot be used to
 *    probe which channels exist).
 * The public results endpoint (`GET /public/quiz-games/{game}/results`) landed
 * in the same wave; see {@link PublicQuizGameResults}.
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

/**
 * Who can FIND a quiz — discovery only, never access to what has already been
 * played (backend, 2026-08-05).
 *
 *  - `shared`  everyone in a channel the quiz has been played in sees it on
 *              that channel's list;
 *  - `private` only the owner sees it there.
 *
 * A GAME THAT HAS ALREADY RUN IS UNAFFECTED, and the UI must say so: its lobby,
 * its results and its chat card stay fully visible to the room even after the
 * owner makes the quiz private. The flag may also be changed WHILE A GAME IS
 * LIVE — unlike the questions, which freeze at the first real play (`409`).
 */
export type ChannelQuizVisibility = 'shared' | 'private';

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
  /**
   * PROVENANCE — the channel this quiz was BORN in. Not "the channel you are
   * looking at", and never a link target.
   *
   * `null` since 2026-08-05, and it means one of TWO things that cannot be told
   * apart from here: the quiz was written straight into its author's library
   * (`POST /channel-quizzes`), or the channel it was born in has since been
   * DELETED (measured — deleting a channel nulls its quizzes' `channel_uuid`,
   * and its finished games then answer `403` to everyone signed in while the
   * public results link keeps serving them).
   *
   * So NOTHING may promise the reader a room from this field: no "from
   * #general", no link back, no name lookup. The channel a quiz is being read
   * IN is the one whose screen is open; the channel a game runs in is
   * {@link QuizGame.channel_uuid}, which is a different field and stays
   * non-null.
   */
  channel_uuid: string | null;
  title: string;
  description: string | null;
  settings: ChannelQuizSettings;
  creator: SlimUser;
  /** Who may find it — see {@link ChannelQuizVisibility}. Owner-editable. */
  visibility: ChannelQuizVisibility;
  /** The server's own answer to "did this viewer write it?" — the ONLY honest
   *  source for the owner-only affordances, since authorship can also be read
   *  from `creator.uuid` but governance (channel admin, space governor,
   *  platform admin) cannot. */
  is_mine: boolean;
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
  /** Owner only, and the ONE field on this payload that a live game does not
   *  freeze (measured 2026-08-05) — so it can be sent on its own at any time. */
  visibility?: ChannelQuizVisibility;
}

/**
 * `POST /channel-quizzes/{quiz}/go-live` — the body that names WHERE to run it.
 *
 * Two measured calls, and only two:
 *  - `{}` on a quiz that was born in the channel it is being run in → `201`;
 *  - `{ channel_uuid }` naming the target room → `201`, with the new game's
 *    `channel_uuid` set to that room.
 * `{}` on a LIBRARY quiz is `403` ("pick a room"), and an unknown target is the
 * same `403` as a room the caller may not host in.
 */
export interface GoLiveChannelQuizPayload {
  channel_uuid?: string;
}

export interface ChannelQuizListParams {
  per_page?: number;
  page?: number;
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
  /**
   * WHERE THIS GAME IS BEING PLAYED — the venue, not the quiz's provenance, and
   * non-null even when {@link ChannelQuiz.channel_uuid} is null (a library quiz
   * run in a room stamps the room here). This is the field a screen may trust
   * to decide which channel a game belongs to.
   */
  channel_uuid: string;
  quiz: { uuid: string; title: string };
  host: SlimUser | null;
  settings: ChannelQuizSettings;
  question_count: number;
  current_question_index: number | null;
  countdown_ends_at: string | null;
  question_opens_at: string | null;
  question_ends_at: string | null;
  /** Mirror of {@link QuizCurrentQuestion.next_opens_at} on the game itself —
   *  an ISO stamp only while a NON-FINAL question is in its reveal, `null` at
   *  every other moment (measured 2026-08-04; column added the same day, so a
   *  game that was already running at that deploy reads `null` until its first
   *  reveal after it). */
  next_question_opens_at: string | null;
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
 * One player's answer arriving, as the state read publishes it. It names WHO
 * and HOW FAST and nothing else — never the option they picked, never whether
 * they were right, in either phase.
 */
export interface QuizAnswerIn {
  user: SlimUser;
  answered_at: string;
  response_ms: number;
}

/**
 * The question currently on screen. `null` outside the question phases.
 * `correct_option_id` / `option_counts` / `no_answer_count` appear ONLY during
 * the reveal — their presence IS the reveal signal in the envelope.
 */
export interface QuizCurrentQuestion {
  /** 0-BASED (measured) — the human number is `index + 1`. */
  index: number;
  question: QuizQuestion;
  opens_at: string;
  ends_at: string;
  /** This is the last question of the game. Present in BOTH question phases,
   *  so the screen can say what comes next before it arrives. */
  is_final: boolean;
  /**
   * Everyone whose answer is already in, in ARRIVAL ORDER, `[]` until the
   * first one lands.
   *
   * OPTIONAL ON PURPOSE, and the reason is the measurement itself: this was
   * seen on `GET /quiz-games/{game}` and nowhere else. The same envelope also
   * comes back from `POST /join` and `POST /start`, which were NOT measured,
   * and those responses are written straight into the same cache entry. A
   * missing field must degrade to "nobody yet", not throw inside a cache
   * write — so every read goes through `answersIn()` in the feature's model.
   */
  answers_in?: QuizAnswerIn[];
  /**
   * When the next question opens, on the same clock as `opens_at`/`ends_at`.
   * `null` while this question is open, an ISO stamp once a NON-FINAL question
   * enters its reveal, and `null` on a final reveal (there is no next one).
   */
  next_opens_at: string | null;
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

/**
 * `GET /quiz-games/{game}` and `POST /quiz-games/{game}/join` — THE
 * authoritative state. Missed events are harmless; this always wins, and since
 * 2026-08-04 reading it is also what DRIVES a stalled game forward (the server
 * runs an overdue transition on any state read, 5s past the published
 * deadline). So polling this is both the transport and the recovery.
 *
 * TWO MEASURED CONSEQUENCES OF EARLY CLOSE. A question closes the moment every
 * eligible player has answered, not only at `ends_at`:
 *  - any question can end at any instant, so no screen may assume the timer
 *    runs out;
 *  - the LAST question skips its reveal entirely — the status goes
 *    `question_open` → `finished`, and `current_question` (with `answers_in`)
 *    becomes `null` in the same frame. Nothing on the wire ever tells a player
 *    whether their final answer was right; only the results envelope does.
 */
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

/* ── The public share card (2026-08-05) ───────────────────────────────────── */

/**
 * One podium line as the PUBLIC endpoint publishes it.
 *
 * DELIBERATELY NOT A {@link SlimUser}, and the difference is the whole point:
 * there is no `uuid` and no `username` here, so a row cannot be matched to an
 * account, cannot be linked to a profile, and must never be passed to anything
 * that expects a person object. It is a NAME, a FACE and a NUMBER — the least
 * that can be said while still being a scoreboard.
 */
export interface PublicQuizPodiumRow {
  rank: number;
  name: string;
  avatar_url: string | null;
  score: number;
}

/**
 * `GET /public/quiz-games/{game}/results` — the share card's whole world.
 *
 * ANONYMOUS AND UNAUTHENTICATED (measured 2026-08-05), and it publishes the
 * podium and light metadata ONLY: no channel, no space, no questions, no
 * answers, no per-question stats, and nobody below third. The members-only
 * {@link QuizGameResults} is unchanged and still carries all of that.
 *
 * ONLY A FINISHED GAME RESOLVES. A lobby, a running game, a cancelled game and
 * an unknown uuid all answer `404` and are indistinguishable from each other —
 * so a reader of this shape gets ONE honest "not here" state, never a guess at
 * which of the four it was.
 *
 * THE UUID IS THE ONLY KEY: the link IS the secret. Anything that hands this
 * link out has to say so once, plainly.
 */
export interface PublicQuizGameResults {
  quiz_title: string;
  question_count: number;
  player_count: number;
  finished_at: string;
  /** Up to three rows, best first. Empty when the game finished with nobody. */
  podium: PublicQuizPodiumRow[];
  top_score: number;
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

/**
 * `player` / `response_ms` / `answered_at` were added on 2026-08-04 so this
 * event can extend the answering list in the frame it arrives. They are typed
 * OPTIONAL because they have never been seen on a wire: server emission is down
 * in production, so nothing in this payload is verified. Treat all three as an
 * accelerator over `current_question.answers_in` — present, they save a poll;
 * absent, the next state read carries the same fact.
 */
export interface QuizAnswerProgressPayload {
  game_uuid: string;
  index: number;
  answered_count: number;
  player_count: number;
  player?: SlimUser;
  response_ms?: number;
  answered_at?: string;
}

export interface QuizQuestionClosedPayload {
  game_uuid: string;
  index: number;
  correct_option_id: number;
  option_counts: QuizOptionCount[];
  no_answer_count: number;
  is_final: boolean;
  /** When the next question opens — the broadcast half of
   *  {@link QuizCurrentQuestion.next_opens_at}, absent on a final close.
   *  Optional for the same reason as {@link QuizAnswerProgressPayload}'s new
   *  fields: documented 2026-08-04, never seen on a wire. */
  next_opens_at?: string | null;
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

/* THE PUBLIC CARD HAS NO ENVELOPE ALIAS, deliberately. Its `200` is the house
   envelope — measured against prod on 2026-08-05, alongside the `404
   {"success":false,…}` that every one of its four refusals answers with — but
   nothing types the wrapper, because its reader
   (`fetchPublicQuizResults` in `lib/api/server.ts`) proves every field it hands
   on rather than casting a body into a shape. A public page cannot afford a
   narrowing that only checks one key: see that reader's docblock. */
