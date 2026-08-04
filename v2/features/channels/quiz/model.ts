import type { Channel } from '@/types/collab';
import type {
  ChannelQuizSettings,
  QuizCurrentQuestion,
  QuizGamePlayer,
  QuizGameState,
  QuizHostPolicy,
} from '@/types/channel-quiz';
import { canManageChannel } from '../model';

/**
 * channel-quiz model — the pure vocabulary of the live game: the host-policy
 * read, the authoring limits, the phase derivation, and the polling cadence
 * the game falls back on when broadcasts are silent. No hooks, no JSX, no
 * browser APIs, so the screens, the dialogs and the state machine all read
 * their constants from one place.
 *
 * Sources: `docs/api/channel-quiz.md` (backend repo, the authoritative
 * contract) and `api-digest.md` §E (lifecycle, scoring, reconnect, gaps) —
 * phase-5 W6, 2026-08-04.
 *
 * THE ONE RULE EVERYTHING ELSE FOLLOWS: **the server is the referee.** Nothing
 * in this module advances a phase, scores an answer or decides that time is
 * up. It shapes what the server said so the screen can draw it.
 */

/* ── Host policy (a CHANNEL setting) ──────────────────────────────────────── */

/**
 * Read `settings.quiz_host_policy` off a channel. The setting rides the
 * untyped `settings` bag, and the server treats ANY unknown value as
 * `all_members` — so this mirrors that exactly rather than inventing a third
 * state the backend does not have.
 */
export function readQuizHostPolicy(
  settings: Record<string, unknown> | null | undefined,
): QuizHostPolicy {
  return settings?.quiz_host_policy === 'admins_only'
    ? 'admins_only'
    : 'all_members';
}

/**
 * May the viewer author a quiz and put it live here? The same policy gates
 * both (backend rule), so there is one predicate.
 *
 * THIS IS A COURTESY GATE, NOT THE SECURITY BOUNDARY. The server enforces the
 * policy on every write and additionally lets space governors and platform
 * admins through — identities this client cannot see from a channel row. So
 * the UI hides affordances it is confident are refused, and a 403 that gets
 * through anyway renders as a designed state, never an error dialog.
 */
export function canHostQuiz(channel: Channel): boolean {
  if (channel.is_member !== true) return false;
  return (
    readQuizHostPolicy(channel.settings) === 'all_members' ||
    canManageChannel(channel)
  );
}

/** Host-policy copy for the authoring surfaces' refusal state. */
export const HOST_POLICY_REFUSAL =
  'Only channel admins can create quizzes and start games here.';

/* ── Authoring limits (server-validated; mirrored to save a round trip) ───── */

export const QUIZ_TITLE_MAX = 255;
export const QUIZ_DESCRIPTION_MAX = 2000;
export const QUIZ_QUESTION_MAX = 500;
export const QUIZ_OPTION_MAX = 200;
export const QUIZ_MIN_QUESTIONS = 1;
export const QUIZ_MAX_QUESTIONS = 20;
export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 4;
export const QUIZ_MIN_SECONDS = 5;
export const QUIZ_MAX_SECONDS = 60;
export const QUIZ_DEFAULT_SECONDS = 20;

/** The timer choices the author picks from — a select, not a free number
 *  field: every value here is inside the server's 5–60s window by
 *  construction, and the ladder is what a quiz actually needs. */
export const QUIZ_SECOND_CHOICES: readonly number[] = [5, 10, 15, 20, 30, 45, 60];

/** Defaults applied server-side when a quiz omits them. */
export const QUIZ_DEFAULT_SETTINGS: ChannelQuizSettings = {
  show_leaderboard: true,
  allow_late_join: true,
};

/* ── Phases ───────────────────────────────────────────────────────────────── */

/**
 * What the screen draws. A one-to-one shaping of `game.status` — deliberately
 * NOT a second state machine: the backend owns the transitions and a client
 * that invented its own would eventually disagree with the referee.
 */
export type QuizGamePhase =
  | 'lobby'
  | 'countdown'
  | 'question'
  | 'reveal'
  | 'finished'
  | 'cancelled';

export function gamePhase(state: QuizGameState): QuizGamePhase {
  switch (state.game.status) {
    case 'lobby':
      return 'lobby';
    case 'countdown':
      return 'countdown';
    case 'question_open':
      return 'question';
    case 'reveal':
      return 'reveal';
    case 'cancelled':
      return 'cancelled';
    case 'finished':
    default:
      return 'finished';
  }
}

/** Terminal games never poll, never accept answers, and never show a timer. */
export function isTerminalPhase(phase: QuizGamePhase): boolean {
  return phase === 'finished' || phase === 'cancelled';
}

/**
 * The server timestamp the current phase counts down to, or `null` when the
 * phase has no published deadline.
 *
 * THE REVEAL HAS NONE, and that is contractual: the backend publishes
 * `countdown_ends_at` and the question's `opens_at`/`ends_at` and nothing for
 * the reveal window. So the reveal shows no countdown at all rather than a
 * guessed one — the next question's arrival is the only honest signal.
 */
export function phaseDeadline(state: QuizGameState): string | null {
  switch (state.game.status) {
    case 'countdown':
      return state.game.countdown_ends_at;
    case 'question_open':
      return state.current_question?.ends_at ?? state.game.question_ends_at;
    default:
      return null;
  }
}

/** The phase's start timestamp — paired with {@link phaseDeadline} it gives a
 *  SKEW-FREE duration (both values come from the same server clock). */
export function phaseStart(state: QuizGameState): string | null {
  switch (state.game.status) {
    case 'question_open':
      return state.current_question?.opens_at ?? state.game.question_opens_at;
    default:
      return null;
  }
}

/**
 * THE reveal predicate — one place, one nullish rule (audit L3).
 *
 * During a reveal the envelope stamps `correct_option_id` (and the pick
 * distribution) onto the current question; their presence IS the reveal, both
 * in the envelope and after a `question_closed` merge. Option ids are numeric
 * and `0` is not a valid one, but `!= null` is used anyway so the predicate
 * cannot be broken by a future id scheme — and so that every call site reads
 * identically instead of drifting between `=== undefined` and `!= null`.
 */
export function isRevealedQuestion(
  question: QuizCurrentQuestion | null | undefined,
): boolean {
  return question?.correct_option_id != null;
}

/** The same predicate against a whole snapshot. */
export function isRevealed(state: QuizGameState): boolean {
  return isRevealedQuestion(state.current_question);
}

/**
 * WHICH QUESTION THE HEADER SAYS THIS IS.
 *
 * The contract does not settle the base of the question fields: its example
 * envelope shows `"index": 1` beside a question `"position": 1`, while an
 * OPTION's `position` is plainly 0-based in the same example. Both readings
 * therefore survive the document, so this derives the answer from the two
 * fields TOGETHER rather than guessing:
 *
 *  - `position === index + 1` can only mean a 1-based position over a 0-based
 *    index, so the position is the human number — use it;
 *  - anything else falls back to `index + 1`.
 *
 * Both are then clamped into `1..question_count`, so no combination of bases
 * can ever put "Question 0 of 10" or "Question 11 of 10" on screen.
 *
 * LIVE-PASS CHECK (owed, cannot be settled statically): play a three-question
 * game and confirm the first question reads "Question 1 of 3".
 */
export function questionNumber(
  current: QuizCurrentQuestion,
  questionCount: number,
): number {
  const { position } = current.question;
  const candidate =
    Number.isFinite(position) && position === current.index + 1
      ? position
      : current.index + 1;
  return Math.min(Math.max(1, candidate), Math.max(1, questionCount));
}

/* ── Snapshot ordering (the dual-authority guard) ─────────────────────────── */

/**
 * A game's position on its own timeline, as a comparable tuple.
 *
 * WHY THIS EXISTS. From the moment broadcasts return, this feature has TWO
 * writers into one cache entry: an event merge (instant) and a polled `GET`
 * (authoritative but in flight for a few hundred milliseconds). Without an
 * ordering rule, a GET issued before a `question_opened` can land after it and
 * rewind the screen to the previous question — closing a question the player
 * is answering, or wiping a reveal they are reading. The timeline is strictly
 * monotonic, so a total order over it is all the defence needed:
 *
 *   lobby < countdown < (question 0 open < question 0 reveal < question 1 open
 *   < …) < finished/cancelled
 *
 * `finished` and `cancelled` share the terminal rank deliberately: both are
 * ends, neither may be rewound, and a game can only ever reach one of them.
 */
export type GameProgress = readonly [stage: number, index: number, revealed: number];

export function gameProgress(state: QuizGameState): GameProgress {
  const index =
    state.current_question?.index ?? state.game.current_question_index ?? 0;
  switch (state.game.status) {
    case 'lobby':
      return [0, 0, 0];
    case 'countdown':
      return [1, 0, 0];
    case 'question_open':
      return [2, index, 0];
    case 'reveal':
      return [2, index, 1];
    default:
      return [3, 0, 0];
  }
}

/**
 * Would adopting `candidate` move the game BACKWARDS from `current`?
 *
 * Two regressions count. The obvious one is a lower point on the timeline. The
 * subtler one is losing an answer at the SAME point: the reader's own
 * `your_answer` is one-shot and immutable server-side, so a frame that drops
 * it for a question we already hold one for can only be a stale read — never
 * news. (A genuinely new question changes the index, which the tuple catches
 * first.)
 */
export function isOlderSnapshot(
  candidate: QuizGameState,
  current: QuizGameState,
): boolean {
  const next = gameProgress(candidate);
  const previous = gameProgress(current);
  for (let i = 0; i < next.length; i += 1) {
    if (next[i] !== previous[i]) return next[i] < previous[i];
  }
  return current.your_answer != null && candidate.your_answer == null;
}

/* ── Players ──────────────────────────────────────────────────────────────── */

export function findPlayer(
  players: readonly QuizGamePlayer[] | undefined,
  userUuid: string | null,
): QuizGamePlayer | null {
  if (!userUuid || !players) return null;
  return players.find((player) => player.user.uuid === userUuid) ?? null;
}

export function isPlaying(
  state: QuizGameState,
  userUuid: string | null,
): boolean {
  return findPlayer(state.game.players, userUuid) !== null;
}

export function isHost(state: QuizGameState, userUuid: string | null): boolean {
  return !!userUuid && state.game.host?.uuid === userUuid;
}

/**
 * Can the viewer still get INTO this game? Lobby always; mid-game only when
 * the game's snapshotted `allow_late_join` is on — and a late joiner plays
 * from the NEXT question, which the UI must say out loud before they commit.
 */
export function canJoinNow(state: QuizGameState): boolean {
  if (isTerminalPhase(gamePhase(state))) return false;
  if (state.game.status === 'lobby') return true;
  return state.game.settings.allow_late_join;
}

/* ── The polling fallback ─────────────────────────────────────────────────── */

/**
 * BROADCAST EMISSION IS DOWN IN PRODUCTION (backend ask
 * `docs/v2-docs/backend-ask-2026-08-04-broadcast-emission-down.md`), so this
 * game must be fully playable with ZERO events. `GET /quiz-games/{game}` is
 * the authoritative state by contract, which makes polling it a legitimate
 * transport rather than a workaround — and when events return they simply
 * arrive first and the poll finds nothing new.
 *
 * THE CADENCE, AND WHY EACH NUMBER:
 *  - `lobby` 4s — nothing is at stake but a player list; slow is fine.
 *  - `countdown` 1.5s — 30 seconds long, and the question after it is timed:
 *    every second of late detection is a second of answering time lost.
 *  - `question` 2s — enough to keep the answer-state honest without hammering;
 *    tightened near the deadline by the rule below.
 *  - `reveal` 1.5s — the reveal window is only ~5s; missing its end by 2s
 *    would eat a fifth of the next question.
 *  - terminal — nothing. A finished or cancelled game never changes again.
 *
 * DEADLINE TIGHTENING. When a phase deadline is known, the next poll is
 * scheduled for just after it ({@link POLL_DEADLINE_GRACE_MS}) instead of the
 * base cadence, so a transition is picked up about a second after it happens
 * rather than up to a full interval later. The grace exists because the server
 * may be ±1s and a poll that lands early only wastes a request.
 */
export const POLL_MS = {
  lobby: 4000,
  countdown: 1500,
  question: 2000,
  reveal: 1500,
} as const;

/** How long after a published deadline the tightened poll fires. */
export const POLL_DEADLINE_GRACE_MS = 400;

/** Cadence floor — no computed interval may schedule faster than this. */
export const POLL_MIN_MS = 900;

/**
 * The next poll delay for a snapshot, or `false` to stop polling entirely.
 * `nowMs` is passed in (never read here) so this stays a pure function and the
 * caller owns the single clock read.
 */
export function pollDelayMs(
  state: QuizGameState,
  nowMs: number,
): number | false {
  const phase = gamePhase(state);
  if (isTerminalPhase(phase)) return false;

  const base =
    phase === 'lobby'
      ? POLL_MS.lobby
      : phase === 'countdown'
        ? POLL_MS.countdown
        : phase === 'reveal'
          ? POLL_MS.reveal
          : POLL_MS.question;

  const deadline = phaseDeadline(state);
  if (!deadline) return base;

  const untilDeadline = Date.parse(deadline) - nowMs;
  if (!Number.isFinite(untilDeadline)) return base;
  // Past the deadline the server is mid-transition: keep the tight cadence
  // rather than the base one, and never faster than the floor.
  const target =
    untilDeadline > 0 ? Math.min(base, untilDeadline + POLL_DEADLINE_GRACE_MS) : base;
  return Math.max(POLL_MIN_MS, target);
}

/* ── Timing constants owned by the client ─────────────────────────────────── */

/**
 * How long the last reveal is held before the podium replaces it.
 *
 * The backend documents `quiz.game.finished` as arriving IMMEDIATELY after the
 * final `question_closed` (digest §E, "known gaps"), so without this hold the
 * final answer would be on screen for a single frame. 3.5s sits inside the
 * 3–5s the contract asks for and matches the ~5s the server gives every other
 * reveal, so the last question does not feel cut short.
 */
export const FINAL_REVEAL_HOLD_MS = 3500;

/** A lobby nobody starts auto-cancels server-side after this long. Stated in
 *  the lobby so an abandoned game reads as a rule, not a failure. */
export const LOBBY_IDLE_LIMIT_MINUTES = 10;

/* ── Scoring vocabulary ───────────────────────────────────────────────────── */

/**
 * `round(1000 × (1 − (response_ms / limit_ms) / 2))` — instant ≈1000, a
 * last-instant correct answer ≈500, wrong or unanswered 0. Never computed
 * client-side; this sentence exists so the UI can EXPLAIN the number the
 * server sent.
 */
export const SPEED_SCORING_NOTE =
  'Right answers score up to 1000 — the faster you answer, the more you keep.';

/** Option markers. Four is the server's maximum, so this can never run out. */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

/** Total picks in a reveal distribution, including the players who answered
 *  nothing — the denominator every share bar is drawn against. */
export function totalPicks(
  counts: readonly { count: number }[] | undefined,
  noAnswerCount: number | undefined,
): number {
  const answered = (counts ?? []).reduce((sum, entry) => sum + entry.count, 0);
  return answered + (noAnswerCount ?? 0);
}
