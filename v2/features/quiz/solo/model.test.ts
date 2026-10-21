import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { UserRole } from '@/types/auth';
import type { QuizAttempt, QuizAttemptResponse } from '@/types/channel-quiz';
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
  attemptHref,
  attemptResultsHref,
  attemptScore,
  canPublishPublicly,
  canTakeQuiz,
  DEFAULT_REVEAL_MODE,
  isFinishedAttempt,
  nextUnanswered,
  orderedQuestions,
  pointsLabel,
  questionCountLabel,
  questionDeadlineMs,
  quizFrontHref,
  quizLengthLabel,
  readsPreview,
  responseMsFor,
  REVEAL_MODE_CHOICES,
  speedLabel,
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

test('points and speed read as a person counts them', () => {
  assert.equal(pointsLabel(1375), '1,375');
  assert.equal(speedLabel(15000), '15s per answer');
  assert.equal(speedLabel(4200), '4.2s per answer');
  assert.equal(speedLabel(null), null);
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
