import type {
  QuizAttempt,
  QuizAttemptAnswerReceipt,
  QuizAttemptComparison,
  QuizAttemptQuestion,
  QuizAttemptResponse,
  QuizRevealMode,
  QuizScenario,
  SubmitQuizAttemptAnswerPayload,
} from '@/types/channel-quiz';
import type { OptionState } from '@/v2/features/channels/quiz/ui';
import { isAccountRole } from '@/v2/runtime/account';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';

/**
 * solo quiz model — the pure vocabulary of a quiz taken alone: who may publish
 * one, who may take one, how it is found, how an attempt is read, and what the
 * player's own clock says. No hooks, no JSX, no browser APIs, so the library,
 * the explore list, the quiz front, the player and the results all read their
 * rules from one place and the node test runner can import it.
 *
 * Source: backend branch quiz-part1-publish-and-solo (tip 45a8f711; bodies in
 * `~/.lawexa/tools/frontend/contracts/quiz-45a8f711.json`), 21 October 2026;
 * the comparison block from ed0f1469, 22 October 2026. The channel game's own
 * vocabulary stays in `channels/quiz/model.ts`; this module imports from it
 * where the two surfaces share a word (the option states, the scoring note)
 * and never redefines it.
 *
 * The screens are drawn in design B1 (Arthur and Stay, 22 October 2026): the
 * question with its segments and thin clock, the reveal sheet, and results
 * that lead with the points. The sentences those screens say — the greeting,
 * the streak, the fastest answer, the comparison line, the challenge — are
 * all here, so the node test runner can hold each one to its words.
 */

/* ── Where things are ─────────────────────────────────────────────────────── */

/**
 * The solo routes sit under `/quiz` beside the practice player, under FIXED
 * prefixes: `app/v2/quiz/[sessionUuid]` catches any other `/quiz/{id}`, so a
 * quiz lives at `/quiz/q/{uuid}` and an attempt at `/quiz/attempts/{uuid}`,
 * never at `/quiz/{uuid}`.
 *
 * The two lists are the Quiz home's tabs (Stay, 23 October 2026); their old
 * addresses, `/quiz/library` and `/quiz/explore`, redirect to these.
 */
export const LIBRARY_HREF = '/quiz?tab=mine';
export const EXPLORE_HREF = '/quiz';

export function quizFrontHref(quizUuid: string): string {
  return `/quiz/q/${quizUuid}`;
}

export function attemptHref(attemptUuid: string): string {
  return `/quiz/attempts/${attemptUuid}`;
}

export function attemptResultsHref(attemptUuid: string): string {
  return `/quiz/attempts/${attemptUuid}/results`;
}

/* ── Who may do what ──────────────────────────────────────────────────────── */

/**
 * May this viewer set a quiz to `public`? The server's own flag
 * (`user.is_verified_author` on `/auth/me`), published on the session
 * snapshot, and nothing else: not the role, not a plan. A COURTESY GATE, like
 * every other presentation flag on the snapshot — the quiz API answers `403`
 * to a public save from anyone else, and the screens render that refusal as
 * a designed line, so a stale snapshot costs one round trip and no error.
 */
export function canPublishPublicly(session: V2SessionSnapshot): boolean {
  return session.signedIn && session.isVerifiedAuthor;
}

/**
 * May this viewer START an attempt? An account, and nothing less: the server
 * answers `401` to a visitor and `403` to a guest pass (Arthur's option B,
 * 21 October 2026 — anyone may browse and preview, taking needs sign-in). The
 * quiz front shows the sign-in door instead of Start for everyone else.
 */
export function canTakeQuiz(session: V2SessionSnapshot): boolean {
  return session.signedIn && isAccountRole(session.role);
}

/**
 * Which read the quiz front makes. An account reads the authenticated `show`
 * (it says `is_mine`, and carries `is_correct` for the author, which is what
 * lets Edit open on the same entry); a visitor or a guest reads the public
 * `preview`, the only read the server answers for them.
 */
export function readsPreview(session: V2SessionSnapshot): boolean {
  return !canTakeQuiz(session);
}

/* ── The reveal choice ────────────────────────────────────────────────────── */

export interface RevealModeChoice {
  id: QuizRevealMode;
  label: string;
  hint: string;
}

/** The two ways to see the answers, in the words the quiz front uses. */
export const REVEAL_MODE_CHOICES: readonly RevealModeChoice[] = [
  {
    id: 'each',
    label: 'After each question',
    hint: 'See the answer the moment you pick, then move on.',
  },
  {
    id: 'end',
    label: 'At the end',
    hint: 'Answer everything first, then see how you did.',
  },
];

/** What the quiz front opens on. */
export const DEFAULT_REVEAL_MODE: QuizRevealMode = 'each';

/* ── Reading a quiz ───────────────────────────────────────────────────────── */

/**
 * How long a quiz takes at most, from its timers: the sum of every question's
 * limit, said in minutes because nobody plans in seconds. Rounded UP, so the
 * promise is never shorter than the clock.
 */
export function quizLengthLabel(
  questions: readonly { time_limit_seconds: number }[],
): string {
  const seconds = questions.reduce((sum, question) => sum + question.time_limit_seconds, 0);
  if (seconds < 60) return 'under a minute';
  return `about ${Math.ceil(seconds / 60)} min`;
}

/** "4 questions", "1 question". */
export function questionCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

/* ── Reading an attempt ───────────────────────────────────────────────────── */

/** The questions in play order. The server serves `position`; array order is
 *  never trusted for a numbered list. A question added to the quiz after the
 *  attempt began (`in_attempt: false`) is left out: it is not in
 *  `question_count` and cannot be played. */
export function orderedQuestions(attempt: QuizAttempt): QuizAttemptQuestion[] {
  return attempt.questions
    .filter((question) => question.in_attempt !== false)
    .sort((a, b) => a.position - b.position);
}

/**
 * Where a resumed attempt picks up: the index (in play order) of the first
 * unanswered question, or `null` when every question has an answer and the
 * only move left is Finish.
 */
export function nextUnanswered(attempt: QuizAttempt): number | null {
  const index = orderedQuestions(attempt).findIndex((question) => !question.answered);
  return index === -1 ? null : index;
}

/** `finished_at` is the one honest "is it over" read — see the type. */
export function isFinishedAttempt(attempt: QuizAttempt): boolean {
  return attempt.finished_at !== null;
}

export interface AttemptScore {
  correct: number;
  answered: number;
  total: number;
  /** The server's `score_percent`, as sent. */
  percent: number;
  points: number;
  /** `scored_count × 1000` (server rule): an unscored question adds nothing. */
  maxPoints: number;
  /** Mean over the answered questions; `null` when none were answered. */
  avgResponseMs: number | null;
}

/**
 * The score a FINISHED attempt carries, or `null` for one still running — or
 * for a finished body that somehow lacks a score field, so nothing can print
 * a number the server did not compute.
 */
export function attemptScore(attempt: QuizAttempt): AttemptScore | null {
  if (!isFinishedAttempt(attempt)) return null;
  const { correct_count, score_percent, points, max_points } = attempt;
  if (
    correct_count === undefined ||
    score_percent === undefined ||
    points === undefined ||
    max_points === undefined
  ) {
    return null;
  }
  return {
    correct: correct_count,
    answered: attempt.answered_count,
    // The questions that count (Arthur, 26 October 2026): a Bonus one is
    // answered but left out of "x of y right".
    total: attempt.scored_count ?? attempt.question_count,
    percent: score_percent,
    points,
    maxPoints: max_points,
    avgResponseMs: attempt.avg_response_ms ?? null,
  };
}

/**
 * The cached attempt with one answer written onto it from its receipt — the
 * same shape `GET` on the attempt now returns, so a reload after the write
 * resumes on the same screen.
 *
 * ON AN `each` ATTEMPT THE RECEIPT IS THE REVEAL: the four verdict fields land
 * on the question. On an `end` attempt the receipt carries counts only, so
 * the question becomes `answered` with the viewer's option and nothing else;
 * in particular the app's own `response_ms` is NOT written, because the
 * server clamps it and the stored value is the server's to say.
 */
export function withAnswer(
  response: QuizAttemptResponse,
  payload: SubmitQuizAttemptAnswerPayload,
  receipt: QuizAttemptAnswerReceipt,
): QuizAttemptResponse {
  const attempt = response.data;
  const questions = attempt.questions.map((question) => {
    if (question.uuid !== payload.question_uuid) return question;
    const answered: QuizAttemptQuestion = {
      ...question,
      answered: true,
      your_option_id: payload.option_id,
    };
    if (receipt.is_correct !== undefined) {
      answered.is_correct = receipt.is_correct;
      answered.correct_option_id = receipt.correct_option_id;
      answered.points = receipt.points;
      answered.response_ms = receipt.response_ms;
    }
    return answered;
  });
  return {
    ...response,
    data: {
      ...attempt,
      answered_count: receipt.answered_count,
      question_count: receipt.question_count,
      questions,
    },
  };
}

/** How many questions have no answer — the number Finish names before it
 *  scores them as wrong. */
export function unansweredCount(attempt: QuizAttempt): number {
  return orderedQuestions(attempt).filter((question) => !question.answered).length;
}

/** Points so far on an `each` attempt: the sum the receipts have handed back.
 *  Never computed from the clock — the server scores, this only adds. */
export function attemptPoints(attempt: QuizAttempt): number {
  return attempt.questions.reduce((sum, question) => sum + (question.points ?? 0), 0);
}

/* ── The player's steps ───────────────────────────────────────────────────── */

/**
 * Where the question on screen is, read from the SERVER's state of it plus
 * two local facts: a send in flight, and the app's own clock having run out.
 *
 *  - `open`       unanswered, time left: the tiles take a tap;
 *  - `sending`    the tap is locked and on the wire;
 *  - `revealed`   answered on an `each` attempt, with its verdict in the cache
 *                 (the receipt, or the resume read);
 *  - `answered`   answered with no verdict to show — an `end` attempt, where
 *                 the verdict waits for the results;
 *  - `timed-out`  unanswered and out of time: locked, nothing recorded.
 *
 * THE SERVER'S WORD COMES FIRST. An answer that lands after the clock ran out
 * (the POST was in flight at zero) still reads `answered`, because the server
 * took it — the clamp costs points, never the answer. Only a question the
 * server has NOT got is ever `timed-out`.
 */
export type PlayStep = 'open' | 'sending' | 'revealed' | 'answered' | 'timed-out';

export function playStep(
  question: QuizAttemptQuestion,
  revealMode: QuizRevealMode,
  sending: boolean,
  timedOut: boolean,
): PlayStep {
  if (question.answered) {
    return revealMode === 'each' && question.correct_option_id != null
      ? 'revealed'
      : 'answered';
  }
  if (sending) return 'sending';
  if (timedOut) return 'timed-out';
  return 'open';
}

/**
 * What one tile says about itself at this step — the channel game's own
 * vocabulary (`OptionTile`), so a reader who plays both reads one language.
 * A reveal paints from the SERVER's `your_option_id` and `correct_option_id`,
 * never from the local tap; the tap only locks the grid while it is in flight.
 */
export function optionTileState(
  optionId: number,
  question: QuizAttemptQuestion,
  step: PlayStep,
  pendingPick: number | null,
): OptionState {
  switch (step) {
    case 'revealed': {
      if (optionId === question.correct_option_id) return 'correct';
      if (optionId === question.your_option_id) return 'wrong-pick';
      return 'missed';
    }
    case 'answered':
      return optionId === question.your_option_id ? 'picked' : 'locked-other';
    case 'sending':
      return optionId === pendingPick ? 'picked' : 'locked-other';
    case 'timed-out':
      return 'locked-other';
    case 'open':
    default:
      return 'idle';
  }
}

/**
 * How long an `end` attempt holds the locked tile before the next question —
 * long enough to see the pick land, short enough that nothing is being
 * waited for.
 */
export const END_MODE_ADVANCE_MS = 350;

/**
 * How long an `each` attempt holds its verdict on the tiles (green ✓ on the
 * right answer, red ✗ on a wrong pick, the points on the tapped tile) before
 * the next question comes in by itself (Arthur, 22 October 2026: "no need for
 * continue button as it should then be a tap to answer"). A tap anywhere
 * moves on at once. The explanations wait for the results' review.
 */
export const REVEAL_HOLD_MS = 1200;

/* ── The player's own clock ───────────────────────────────────────────────── */

/**
 * The app's `response_ms`: how long the question was on screen before the
 * tap, from two `performance.now()` readings (monotonic, so a clock change
 * mid-question cannot make it negative or absurd). Whole milliseconds, never
 * below zero. The server clamps it to the question's limit on its side.
 */
export function responseMsFor(openedPerfMs: number, nowPerfMs: number): number {
  return Math.max(0, Math.round(nowPerfMs - openedPerfMs));
}

/** When the question's time runs out, on the wall clock the timer draws from. */
export function questionDeadlineMs(openedAtMs: number, limitSeconds: number): number {
  return openedAtMs + limitSeconds * 1000;
}

/* ── Results vocabulary ───────────────────────────────────────────────────── */

/**
 * How one question of a FINISHED attempt went. A question never answered
 * comes back `is_correct: false` with `your_option_id: null` — the same
 * false as a wrong pick on the wire, and a different fact to the reader, so
 * it gets its own word rather than "Incorrect".
 */
export type QuestionVerdict = 'correct' | 'incorrect' | 'unanswered';

export function questionVerdict(question: QuizAttemptQuestion): QuestionVerdict {
  if (!question.answered || question.your_option_id == null) return 'unanswered';
  return question.is_correct === true ? 'correct' : 'incorrect';
}

/** "1,375" — points as a reader counts them. `en-US` on purpose: the server's
 *  comparison line and the hero number must agree on every device. */
export function pointsLabel(points: number): string {
  return points.toLocaleString('en-US');
}

/**
 * "0.5 s", "12 s" — a duration as the B1 screens print it, with the space the
 * design draws (the clock, the reveal's "in 1.6 s", the stat row's fastest).
 * One decimal under ten seconds, whole seconds from there, the channel
 * game's own rounding.
 */
export function secondsLabel(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`;
}

/* ── The results' sentences ───────────────────────────────────────────────── */

/**
 * The one small line under the stat row, from the server's comparison block
 * (backend ed0f1469), or `null` when there is nothing to say: a first attempt
 * has no best to beat, and a body without the block (an older server, an
 * unfinished attempt) claims nothing. `better_than_percent` is unused for
 * now, by agreement.
 */
export function comparisonLine(
  comparison: QuizAttemptComparison | undefined,
  points: number,
): string | null {
  if (!comparison || comparison.previous_best_points === null) return null;
  const best = comparison.previous_best_points;
  if (comparison.is_personal_best) return `New personal best, up from ${pointsLabel(best)}.`;
  if (points === best) return 'Equal to your best.';
  const behind = best - points;
  return `${pointsLabel(behind)} ${behind === 1 ? 'point' : 'points'} off your best here.`;
}

/** Good is at least half right (the greeting's rule, 22 October 2026). */
export type RunTone = 'good' | 'poor';

export function runTone(score: Pick<AttemptScore, 'correct' | 'total'>): RunTone {
  return score.correct * 2 >= score.total ? 'good' : 'poor';
}

/** The first word of a display name, or `null` for an account without one. */
export function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/** "Nice one, Ada." / "Getting there, Ada." — and without a name, the same
 *  two words alone rather than a comma hanging on nothing. */
export function greeting(tone: RunTone, name: string | null): string {
  const opener = tone === 'good' ? 'Nice one' : 'Getting there';
  const first = firstName(name);
  return first ? `${opener}, ${first}.` : `${opener}.`;
}

/**
 * The longest run of right answers, in PLAY order (pass `orderedQuestions`).
 * A question never answered breaks a run like a wrong one does: the score
 * counts it as wrong, and a streak that skipped over it would be a lie.
 */
export function bestStreak(questions: readonly QuizAttemptQuestion[]): number {
  let best = 0;
  let run = 0;
  for (const question of questions) {
    run = question.is_correct === true ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The run of right answers ending at `index` (play order): `0` when that
 *  question was wrong, unanswered or past the end. */
export function streakEndingAt(
  questions: readonly QuizAttemptQuestion[],
  index: number,
): number {
  let run = 0;
  for (let position = 0; position <= index && position < questions.length; position += 1) {
    run = questions[position].is_correct === true ? run + 1 : 0;
  }
  return run;
}

/**
 * The quickest RIGHT answer, in ms, or `null` with none. Only right answers
 * compete: speed scores nothing on a wrong one, so a fast miss is not a
 * personal fastest. The time is the server's clamped `response_ms`.
 */
export function fastestCorrectMs(questions: readonly QuizAttemptQuestion[]): number | null {
  let fastest: number | null = null;
  for (const question of questions) {
    if (question.is_correct !== true || question.response_ms == null) continue;
    if (fastest === null || question.response_ms < fastest) fastest = question.response_ms;
  }
  return fastest;
}

/** How many questions the review is worth opening for: every one that was
 *  not right — wrong picks and the ones never answered alike. */
export function toReviewCount(questions: readonly QuizAttemptQuestion[]): number {
  return questions.filter((question) => questionVerdict(question) !== 'correct').length;
}

/** The fold row's second line: "6 questions, 1 to look at again". */
export function reviewSubtitle(total: number, toReview: number): string {
  const count = questionCountLabel(total);
  return toReview === 0 ? `${count}, all right` : `${count}, ${toReview} to look at again`;
}

/** The three numbers a finished attempt is summed up by, beside the points. */
export interface AttemptHighlights {
  correct: number;
  total: number;
  /** The best streak. */
  streak: number;
  fastestMs: number | null;
}

export function attemptHighlights(
  score: Pick<AttemptScore, 'correct' | 'total'>,
  questions: readonly QuizAttemptQuestion[],
): AttemptHighlights {
  return {
    correct: score.correct,
    total: score.total,
    streak: bestStreak(questions),
    fastestMs: fastestCorrectMs(questions),
  };
}

/** "5 of 6 right · 4 in a row · fastest 0.5 s" — the share card's line, and
 *  the challenge's. Fastest is left out when nothing was right. */
export function statsLine(highlights: AttemptHighlights): string {
  const parts = [
    `${highlights.correct} of ${highlights.total} right`,
    `${highlights.streak} in a row`,
  ];
  if (highlights.fastestMs !== null) parts.push(`fastest ${secondsLabel(highlights.fastestMs)}`);
  return parts.join(' · ');
}

/**
 * What Challenge a friend hands to the share sheet beside the quiz's link:
 * who scored what on which quiz, the stat line, and the ask. The reader's
 * first name where there is one; "I" otherwise, since the sender is the one
 * speaking.
 */
export function challengeText(
  name: string | null,
  points: number,
  quizTitle: string,
  highlights: AttemptHighlights,
): string {
  const who = firstName(name);
  const opener = who ? `${who} scored` : 'I scored';
  return `${opener} ${pointsLabel(points)} ${points === 1 ? 'point' : 'points'} on ${quizTitle}. ${statsLine(highlights)}. Can you beat me?`;
}

/* ── The question screen's words ──────────────────────────────────────────── */

/** The fact pattern a question is about, or `null` for a free-standing one
 *  (and for a body that names a scenario it does not carry). */
export function scenarioFor(
  attempt: Pick<QuizAttempt, 'scenarios'>,
  question: Pick<QuizAttemptQuestion, 'scenario_uuid'>,
): QuizScenario | null {
  if (question.scenario_uuid == null) return null;
  return attempt.scenarios?.find((scenario) => scenario.uuid === question.scenario_uuid) ?? null;
}

/**
 * One segment of the progress bar per question. `done` for an answer the
 * server has, `miss` for one it has said was wrong (an `each` attempt only;
 * an `end` attempt learns nothing until the results, so every answer there
 * is `done`), `now` for the question on screen, `todo` for the rest — a
 * question skipped on the clock included, since nothing was recorded for it.
 */
export type SegmentTone = 'done' | 'miss' | 'now' | 'todo';

export function progressSegments(
  questions: readonly QuizAttemptQuestion[],
  cursor: number,
): SegmentTone[] {
  return questions.map((question, index) => {
    if (question.answered) return question.is_correct === false ? 'miss' : 'done';
    return index === cursor ? 'now' : 'todo';
  });
}

/**
 * Turn an answer failure into one honest sentence, or `null` when the screen
 * has nothing to add.
 *
 * Keyed on STATUS, never on message text. A `409` is settled by re-reading the
 * attempt (the mutation does that), so it needs no sentence of its own: the
 * refreshed attempt shows the answer the server already had, or the results.
 * A `404` is an option that is not this question's — the quiz changed under
 * the attempt — and a failure with no response is the one case where nothing
 * is known, so nothing is claimed.
 */
export function answerRefusalCopy(status: number, message: string): string | null {
  switch (status) {
    case 409:
      return null;
    case 404:
      return "That answer doesn't match the question on screen. Pick again.";
    case 0:
      return "We didn't hear back about that answer. If it reached us, it still counts.";
    default:
      return message;
  }
}

/**
 * What "End quiz" says before it ends (Arthur, 24 October 2026): the attempt
 * is scored on the answers given, and the rest count as wrong.
 */
export function endAttemptCopy(answered: number, total: number): string {
  if (answered <= 0) return `You haven't answered any of the ${total} questions yet, so your score will be 0. You can take the quiz again any time.`;
  const left = Math.max(0, total - answered);
  const done = `You've answered ${answered} of ${total}.`;
  return left === 0
    ? `${done} Your score and every answer come next.`
    : `${done} Your score counts those, and the ${left} left count as wrong. You can take the quiz again any time.`;
}
