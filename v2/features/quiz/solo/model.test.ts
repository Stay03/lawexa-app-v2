import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { UserRole } from '@/types/auth';
import type {
  QuizAttempt,
  QuizAttemptComparison,
  QuizAttemptResponse,
} from '@/types/channel-quiz';
import {
  isQuizVisibility,
  PUBLIC_NEEDS_VERIFIED_AUTHOR,
  QUIZ_VISIBILITY_CHOICES,
  quizHasRoom,
  visibilityChoicesFor,
  visibilityFace,
} from '@/v2/features/channels/quiz/model';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';
import {
  answerRefusalCopy,
  attemptHighlights,
  attemptHref,
  attemptResultsHref,
  attemptScore,
  bestStreak,
  canPublishPublicly,
  canTakeQuiz,
  challengeText,
  comparisonLine,
  DEFAULT_REVEAL_MODE,
  fastestCorrectMs,
  firstName,
  greeting,
  isFinishedAttempt,
  nextUnanswered,
  orderedQuestions,
  pointsLabel,
  progressSegments,
  questionCountLabel,
  questionDeadlineMs,
  quizFrontHref,
  quizLengthLabel,
  readsPreview,
  responseMsFor,
  REVEAL_MODE_CHOICES,
  reviewSubtitle,
  runTone,
  scenarioFor,
  secondsLabel,
  statsLine,
  streakEndingAt,
  toReviewCount,
  withAnswer,
} from './model';

/* The solo quiz (backend branch quiz-part1-publish-and-solo, 21 October 2026):
 * a quiz taken alone, kept in a library, found on the explore list or by
 * link. Pure rules first, then the wiring, pinned by source. The attempt
 * bodies below are the contract's own (quiz-45a8f711.json, keys 4c and 3a),
 * trimmed to the fields the rules read. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const session = (
  role: UserRole | null,
  extra: Partial<V2SessionSnapshot> = {},
): V2SessionSnapshot =>
  ({
    signedIn: role !== null,
    userId: role === null ? null : 7,
    userUuid: role === null ? null : 'u7',
    name: null,
    email: null,
    avatarUrl: null,
    username: null,
    role,
    isVerified: true,
    authProvider: 'google',
    canSetPrice: false,
    isAmbassador: null,
    profileCountryName: null,
    profileCountryCode: null,
    isLawyer: false,
    canAccessTeamChannels: false,
    isVerifiedAuthor: false,
    ...extra,
  }) as V2SessionSnapshot;

const trueFalse = (uuid: string, position: number, firstId: number) => ({
  uuid,
  type: 'true_false' as const,
  question: `Q${position}`,
  time_limit_seconds: 20,
  position,
  scenario_uuid: null,
  options: [
    { id: firstId, content: 'True', position: 0 },
    { id: firstId + 1, content: 'False', position: 1 },
  ],
});

/** Key 4c: an `each` attempt with two of four answered, served out of order. */
function inProgress(): QuizAttempt {
  return {
    uuid: 'a78ef286',
    quiz: { uuid: 'f4a3095a', title: 'Land Law Problems', description: 'Two facts patterns', creator: { uuid: '3f468fc4', name: 'Ada Author', avatar_url: null } },
    reveal_mode: 'each',
    question_count: 4,
    answered_count: 2,
    started_at: '2026-10-21T16:29:55+00:00',
    finished_at: null,
    questions: [
      { ...trueFalse('q3', 2, 5), answered: false },
      { ...trueFalse('q1', 0, 1), answered: true, your_option_id: 1, correct_option_id: 1, is_correct: true, points: 875, response_ms: 5000 },
      { ...trueFalse('q4', 3, 7), answered: false },
      { ...trueFalse('q2', 1, 3), answered: true, your_option_id: 4, correct_option_id: 3, is_correct: false, points: 0, response_ms: 20000 },
    ],
  };
}

/** Key 3a: the same attempt finished with three answered, one skipped. */
function finished(): QuizAttempt {
  return {
    ...inProgress(),
    answered_count: 3,
    correct_count: 2,
    score_percent: 50,
    points: 1375,
    max_points: 4000,
    avg_response_ms: 15000,
    finished_at: '2026-10-21T16:29:55+00:00',
  };
}

const envelope = (attempt: QuizAttempt): QuizAttemptResponse => ({
  success: true,
  message: 'Attempt retrieved successfully.',
  data: attempt,
});

/* ── Who may do what ──────────────────────────────────────────────────────── */

test('publishing to everyone follows the server flag, whatever the role says', () => {
  assert.equal(canPublishPublicly(session('user', { isVerifiedAuthor: true })), true);
  assert.equal(canPublishPublicly(session('user')), false);
  assert.equal(canPublishPublicly(session('admin')), false);
  assert.equal(canPublishPublicly(session('researcher')), false);
  assert.equal(canPublishPublicly(session(null)), false);
  assert.match(PUBLIC_NEEDS_VERIFIED_AUTHOR, /verified authors/);
});

test('taking a quiz needs an account; a visitor and a guest read the preview instead', () => {
  assert.equal(canTakeQuiz(session('user')), true);
  assert.equal(canTakeQuiz(session('researcher')), true);
  assert.equal(canTakeQuiz(session('guest')), false);
  assert.equal(canTakeQuiz(session('bot')), false);
  assert.equal(canTakeQuiz(session(null)), false);
  assert.equal(readsPreview(session('user')), false);
  assert.equal(readsPreview(session('guest')), true);
  assert.equal(readsPreview(session(null)), true);
});

test('the flag travels from /auth/me to the snapshot through the DAL and the layout', () => {
  assert.match(read('types', 'auth.ts'), /is_verified_author\?: boolean;/);
  const dal = read('v2', 'runtime', 'session.ts');
  assert.match(dal, /is_verified_author: boolean;/);
  assert.match(dal, /is_verified_author: user\.is_verified_author === true,/);
  assert.match(read('app', 'v2', 'layout.tsx'), /isVerifiedAuthor=\{user\?\.is_verified_author \?\? false\}/);
  const context = read('v2', 'runtime', 'session-context.tsx');
  assert.match(context, /readonly isVerifiedAuthor: boolean;/);
  // Both the memo value and its dependency list carry it, or the snapshot
  // would go stale behind a referentially stable context.
  assert.equal(context.match(/isVerifiedAuthor,/g)?.length, 3);
});

/* ── The vocabulary ───────────────────────────────────────────────────────── */

test('the four visibilities have words, public needs a verified author, and shared needs a room', () => {
  assert.deepEqual(QUIZ_VISIBILITY_CHOICES.map((choice) => choice.id), ['shared', 'private', 'link', 'public']);
  assert.deepEqual(QUIZ_VISIBILITY_CHOICES.filter((choice) => choice.needsVerifiedAuthor).map((choice) => choice.id), ['public']);
  assert.deepEqual(visibilityChoicesFor(true).map((choice) => choice.id), ['shared', 'private', 'link', 'public']);
  assert.deepEqual(visibilityChoicesFor(false).map((choice) => choice.id), ['private', 'link', 'public']);
  assert.equal(visibilityFace('private'), 'Only me');
  assert.equal(visibilityFace('link'), 'By link');
  assert.equal(visibilityFace('public'), 'Public');
  assert.equal(visibilityFace('shared'), 'In channels');
  // A room is in the picture when the quiz was born in one or already says so.
  assert.equal(quizHasRoom({ channel_uuid: 'c1', visibility: 'private' }), true);
  assert.equal(quizHasRoom({ channel_uuid: null, visibility: 'shared' }), true);
  assert.equal(quizHasRoom({ channel_uuid: null, visibility: 'link' }), false);
  assert.equal(isQuizVisibility('public'), true);
  assert.equal(isQuizVisibility('everyone'), false);
});

test('the reveal choice offers each and end, opening on each', () => {
  assert.deepEqual(REVEAL_MODE_CHOICES.map((choice) => choice.id), ['each', 'end']);
  assert.equal(DEFAULT_REVEAL_MODE, 'each');
  for (const choice of REVEAL_MODE_CHOICES) assert.ok(choice.label && choice.hint, choice.id);
});

test('the solo routes sit under fixed prefixes beside the practice player', () => {
  assert.equal(quizFrontHref('abc'), '/quiz/q/abc');
  assert.equal(attemptHref('abc'), '/quiz/attempts/abc');
  assert.equal(attemptResultsHref('abc'), '/quiz/attempts/abc/results');
});

/* ── Reading a quiz ───────────────────────────────────────────────────────── */

test('a quiz is described by its count and the sum of its timers, rounded up', () => {
  assert.equal(questionCountLabel(1), '1 question');
  assert.equal(questionCountLabel(4), '4 questions');
  assert.equal(quizLengthLabel([{ time_limit_seconds: 20 }, { time_limit_seconds: 30 }]), 'under a minute');
  assert.equal(quizLengthLabel([{ time_limit_seconds: 20 }, { time_limit_seconds: 40 }]), 'about 1 min');
  assert.equal(quizLengthLabel(Array.from({ length: 4 }, () => ({ time_limit_seconds: 20 }))), 'about 2 min');
  assert.equal(quizLengthLabel([]), 'under a minute');
});

/* ── Reading an attempt ───────────────────────────────────────────────────── */

test('an attempt plays in position order and resumes on the first unanswered question', () => {
  const attempt = inProgress();
  assert.deepEqual(orderedQuestions(attempt).map((question) => question.uuid), ['q1', 'q2', 'q3', 'q4']);
  assert.equal(nextUnanswered(attempt), 2);
  assert.equal(isFinishedAttempt(attempt), false);
  assert.equal(attemptScore(attempt), null);
  const allAnswered = { ...attempt, questions: attempt.questions.map((question) => ({ ...question, answered: true })) };
  assert.equal(nextUnanswered(allAnswered), null);
});

test('a finished attempt carries the score the server computed, and only then', () => {
  const attempt = finished();
  assert.equal(isFinishedAttempt(attempt), true);
  assert.deepEqual(attemptScore(attempt), {
    correct: 2,
    answered: 3,
    total: 4,
    percent: 50,
    points: 1375,
    maxPoints: 4000,
    avgResponseMs: 15000,
  });
  // A finished body missing a score field prints nothing rather than a guess.
  assert.equal(attemptScore({ ...attempt, points: undefined }), null);
  assert.equal(attemptScore({ ...attempt, avg_response_ms: undefined })?.avgResponseMs, null);
});

test('an each receipt writes the reveal onto the question; an end receipt only marks it answered', () => {
  const before = envelope(inProgress());
  const payload = { question_uuid: 'q3', option_id: 6, response_ms: 4321 };
  const each = withAnswer(before, payload, {
    answered_count: 3,
    question_count: 4,
    is_correct: true,
    correct_option_id: 6,
    points: 500,
    response_ms: 20000,
  });
  const revealed = each.data.questions.find((question) => question.uuid === 'q3');
  assert.deepEqual(
    { ...revealed, options: undefined },
    { ...trueFalse('q3', 2, 5), options: undefined, answered: true, your_option_id: 6, correct_option_id: 6, is_correct: true, points: 500, response_ms: 20000 },
  );
  assert.equal(each.data.answered_count, 3);
  // Untouched questions keep their identity; the envelope is a new object.
  assert.equal(each.data.questions[1], before.data.questions[1]);
  assert.notEqual(each, before);
  assert.equal(before.data.questions[0].answered, false);

  const end = withAnswer(before, payload, { answered_count: 3, question_count: 4 });
  const marked = end.data.questions.find((question) => question.uuid === 'q3');
  assert.equal(marked?.answered, true);
  assert.equal(marked?.your_option_id, 6);
  assert.equal(marked?.is_correct, undefined);
  assert.equal(marked?.correct_option_id, undefined);
  assert.equal(marked?.response_ms, undefined);
});

/* ── The player's own clock ───────────────────────────────────────────────── */

test('response_ms is a whole non-negative reading of the monotonic clock', () => {
  assert.equal(responseMsFor(1000, 5000.6), 4001);
  assert.equal(responseMsFor(5000, 4000), 0);
  assert.equal(questionDeadlineMs(1_700_000_000_000, 20), 1_700_000_020_000);
});

/* ── Results vocabulary ───────────────────────────────────────────────────── */

test('points and seconds read as a person counts them', () => {
  assert.equal(pointsLabel(1375), '1,375');
  assert.equal(pointsLabel(0), '0');
  assert.equal(secondsLabel(500), '0.5 s');
  assert.equal(secondsLabel(1640), '1.6 s');
  assert.equal(secondsLabel(15000), '15 s');
  assert.equal(secondsLabel(-5), '0.0 s');
});

/* ── The results' sentences (B1, 22 October 2026) ────────────────────────── */

const comparison = (over: Partial<QuizAttemptComparison> = {}): QuizAttemptComparison => ({
  players_compared: 12,
  better_than_percent: 70,
  attempt_number: 3,
  previous_best_points: 4120,
  is_personal_best: false,
  ...over,
});

test('the comparison line: a new best, a tie, a gap, nothing on a first attempt, nothing without the block', () => {
  assert.equal(comparisonLine(comparison({ is_personal_best: true }), 4858), 'New personal best, up from 4,120.');
  assert.equal(comparisonLine(comparison(), 4120), 'Equal to your best.');
  assert.equal(comparisonLine(comparison(), 3980), '140 points off your best here.');
  // One is one point (backend's shots3: "1 points off your best here").
  assert.equal(comparisonLine(comparison(), 4119), '1 point off your best here.');
  assert.equal(comparisonLine(comparison({ previous_best_points: 12400 }), 1964), '10,436 points off your best here.');
  // A first attempt: the server says personal best with no best before it.
  assert.equal(comparisonLine(comparison({ attempt_number: 1, previous_best_points: null, is_personal_best: true }), 4858), null);
  assert.equal(comparisonLine(undefined, 4858), null);
  // `better_than_percent` says nothing yet, whatever it holds.
  assert.equal(comparisonLine(comparison({ better_than_percent: null }), 4120), 'Equal to your best.');
});

test("the comparison line on the backend's own three runs of one quiz (local server, 22 October 2026)", () => {
  // First try: 2,100 of 3,000, nobody else has finished it.
  assert.equal(
    comparisonLine({ players_compared: 0, better_than_percent: null, attempt_number: 1, previous_best_points: null, is_personal_best: true }, 2100),
    null,
  );
  // Second try beats it.
  assert.equal(
    comparisonLine({ players_compared: 0, better_than_percent: null, attempt_number: 2, previous_best_points: 2100, is_personal_best: true }, 2889),
    'New personal best, up from 2,100.',
  );
  // Third try falls short of the second.
  assert.equal(
    comparisonLine({ players_compared: 0, better_than_percent: null, attempt_number: 3, previous_best_points: 2889, is_personal_best: false }, 1900),
    '989 points off your best here.',
  );
});

test('the greeting is good at half right, and takes the first name or none', () => {
  assert.equal(runTone({ correct: 3, total: 6 }), 'good');
  assert.equal(runTone({ correct: 5, total: 6 }), 'good');
  assert.equal(runTone({ correct: 2, total: 6 }), 'poor');
  assert.equal(runTone({ correct: 2, total: 5 }), 'poor');
  assert.equal(runTone({ correct: 0, total: 0 }), 'good');
  assert.equal(firstName('Ada Author'), 'Ada');
  assert.equal(firstName('  Banner  '), 'Banner');
  assert.equal(firstName(''), null);
  assert.equal(firstName(null), null);
  assert.equal(greeting('good', 'Ada Author'), 'Nice one, Ada.');
  assert.equal(greeting('poor', 'Banner'), 'Getting there, Banner.');
  assert.equal(greeting('good', null), 'Nice one.');
  assert.equal(greeting('poor', ' '), 'Getting there.');
});

test('the streak counts right answers in a row, and a skipped question breaks it', () => {
  const right = (uuid: string, position: number, responseMs = 3000) =>
    ({ ...trueFalse(uuid, position, 1), answered: true, your_option_id: 1, correct_option_id: 1, is_correct: true, points: 800, response_ms: responseMs });
  const wrong = (uuid: string, position: number) =>
    ({ ...trueFalse(uuid, position, 1), answered: true, your_option_id: 2, correct_option_id: 1, is_correct: false, points: 0, response_ms: 500 });
  const skipped = (uuid: string, position: number) =>
    ({ ...trueFalse(uuid, position, 1), answered: false, your_option_id: null, correct_option_id: 1, is_correct: false, points: 0, response_ms: null });
  const rows = [right('a', 0), right('b', 1, 4200), wrong('c', 2), right('d', 3, 500), right('e', 4), right('f', 5, 9900)];
  assert.equal(bestStreak(rows), 3);
  assert.equal(bestStreak([right('a', 0), skipped('b', 1), right('c', 2)]), 1);
  assert.equal(bestStreak([wrong('a', 0)]), 0);
  assert.equal(bestStreak([]), 0);
  // The run ending at a question, for the reveal sheet.
  assert.equal(streakEndingAt(rows, 1), 2);
  assert.equal(streakEndingAt(rows, 2), 0);
  assert.equal(streakEndingAt(rows, 5), 3);
  assert.equal(streakEndingAt(rows, -1), 0);
  assert.equal(streakEndingAt(rows, 99), 3);
  // Fastest is the quickest RIGHT answer; a fast miss does not count.
  assert.equal(fastestCorrectMs(rows), 500);
  assert.equal(fastestCorrectMs([wrong('a', 0), skipped('b', 1)]), null);
  assert.equal(fastestCorrectMs([]), null);
  // The review is worth opening for every question that was not right.
  assert.equal(toReviewCount(rows), 1);
  assert.equal(toReviewCount([right('a', 0), skipped('b', 1), wrong('c', 2)]), 2);
  assert.equal(reviewSubtitle(6, 1), '6 questions, 1 to look at again');
  assert.equal(reviewSubtitle(6, 4), '6 questions, 4 to look at again');
  assert.equal(reviewSubtitle(6, 0), '6 questions, all right');
  assert.equal(reviewSubtitle(1, 1), '1 question, 1 to look at again');
  // The stat line and the challenge read the same numbers.
  const highlights = attemptHighlights({ correct: 5, total: 6 }, rows);
  assert.deepEqual(highlights, { correct: 5, total: 6, streak: 3, fastestMs: 500 });
  assert.equal(statsLine(highlights), '5 of 6 right · 3 in a row · fastest 0.5 s');
  assert.equal(statsLine({ correct: 0, total: 6, streak: 0, fastestMs: null }), '0 of 6 right · 0 in a row');
  assert.equal(
    challengeText('Banner Okoro', 4858, 'Land Law Problems', highlights),
    'Banner scored 4,858 points on Land Law Problems. 5 of 6 right · 3 in a row · fastest 0.5 s. Can you beat me?',
  );
  assert.equal(
    challengeText(null, 1964, 'Land Law Problems', { correct: 2, total: 6, streak: 2, fastestMs: 500 }),
    'I scored 1,964 points on Land Law Problems. 2 of 6 right · 2 in a row · fastest 0.5 s. Can you beat me?',
  );
});

test('the question screen finds its passage, and lights one segment per question', () => {
  const scenario = { uuid: 's1', title: null, passage: 'Adaeze buys a plot in Lekki.', position: 0 };
  assert.equal(scenarioFor({ scenarios: [scenario] }, { scenario_uuid: 's1' }), scenario);
  assert.equal(scenarioFor({ scenarios: [scenario] }, { scenario_uuid: 's2' }), null);
  assert.equal(scenarioFor({ scenarios: [scenario] }, { scenario_uuid: null }), null);
  assert.equal(scenarioFor({}, { scenario_uuid: 's1' }), null);
  assert.equal(scenarioFor({ scenarios: [scenario] }, {}), null);
  // Key 4c in play order: right, wrong, on screen, to come.
  assert.deepEqual(progressSegments(orderedQuestions(inProgress()), 2), ['done', 'miss', 'now', 'todo']);
  // An `end` attempt has no verdicts yet, so every answer is simply done;
  // a question skipped on the clock is unlit, since nothing was recorded.
  const end = orderedQuestions(inProgress()).map((question) => ({ ...question, is_correct: undefined }));
  assert.deepEqual(progressSegments(end, 3), ['done', 'done', 'todo', 'now']);
  assert.deepEqual(progressSegments(end, 4), ['done', 'done', 'todo', 'todo']);
});

test('a 409 has no sentence (the re-read answers it); a lost request claims nothing', () => {
  assert.equal(answerRefusalCopy(409, 'This question has already been answered.'), null);
  assert.match(answerRefusalCopy(404, 'Not found.') ?? '', /Pick again/);
  assert.match(answerRefusalCopy(0, 'Network error. Please try again.') ?? '', /still counts/);
  assert.equal(answerRefusalCopy(500, 'Server error.'), 'Server error.');
});

/* ── The wiring ───────────────────────────────────────────────────────────── */

test('the solo queries live under the channel-quiz root, partitioned by viewer', () => {
  const queries = read('v2', 'features', 'quiz', 'solo', 'queries.ts');
  assert.match(queries, /exploreOf: \(\) => \[\.\.\.channelQuizQueries\.all, 'explore'\] as const/);
  assert.match(queries, /libraryOf: \(\) => \[\.\.\.channelQuizQueries\.all, 'my-library'\] as const/);
  assert.match(queries, /previewOf: \(quizUuid: string\) =>\s*\[\.\.\.channelQuizQueries\.all, 'preview', quizUuid\] as const/);
  assert.match(queries, /attemptOf: \(attemptUuid: string\) =>\s*\[\.\.\.channelQuizQueries\.all, 'attempt', attemptUuid\] as const/);
  assert.equal(queries.match(/\{ viewerId \}\] as const/g)?.length, 4);
  // The attempt is a live read; the two lists re-check on every arrival.
  assert.match(queries, /quizAttemptsApi\.show\(attemptUuid\),\s*staleTime: STALE_TIMES\.live,/);
  assert.equal(queries.match(/refetchOnMount: REFETCH_ON_VISIT,/g)?.length, 2);
});

test('the attempt mutations seed, patch and re-read the one attempt key', () => {
  const mutations = read('v2', 'features', 'quiz', 'solo', 'mutations.ts');
  assert.match(mutations, /soloQuizQueries\.attempt\(response\.data\.uuid, \{ viewerId \}\)\.queryKey,\s*response,/);
  assert.match(mutations, /scope: \{ id: `quiz-attempt-answer:\$\{attemptUuid\}` \}/);
  assert.match(mutations, /current \? withAnswer\(current, payload, response\.data\) : current/);
  assert.equal(mutations.match(/status === 409\) \{\s*void queryClient\.invalidateQueries\(\{ queryKey: attemptKey \}\);/g)?.length, 2);
  assert.equal(mutations.match(/meta: \{ silentError: true \}/g)?.length, 3);
});
