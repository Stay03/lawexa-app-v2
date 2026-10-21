import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizAttempt, QuizAttemptQuestion } from '@/types/channel-quiz';
import {
  attemptPoints,
  END_MODE_ADVANCE_MS,
  optionTileState,
  playStep,
  unansweredCount,
} from './model';

/* The solo player (/quiz/attempts/{uuid}, 21 October 2026): the server holds
 * the answers, the screen holds the place, the app runs the clock. Pure rules
 * first, then the wiring, pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const question = (over: Partial<QuizAttemptQuestion> = {}): QuizAttemptQuestion => ({
  uuid: 'q1',
  type: 'multiple_choice',
  question: 'Which case?',
  time_limit_seconds: 30,
  position: 0,
  options: [
    { id: 3, content: 'Carlill', position: 0 },
    { id: 4, content: 'Donoghue', position: 1 },
    { id: 5, content: 'Hadley', position: 2 },
  ],
  answered: false,
  ...over,
});

const attempt = (questions: QuizAttemptQuestion[]): QuizAttempt => ({
  uuid: 'a1',
  quiz: { uuid: 'z1', title: 'Contract Drill', description: null, creator: null },
  reveal_mode: 'each',
  question_count: questions.length,
  answered_count: questions.filter((entry) => entry.answered).length,
  started_at: '2026-10-21T15:44:16+00:00',
  finished_at: null,
  questions,
});

/* ── The steps ────────────────────────────────────────────────────────────── */

test("the server's word comes first: an answered question is revealed or answered, never timed out", () => {
  const open = question();
  assert.equal(playStep(open, 'each', false, false), 'open');
  assert.equal(playStep(open, 'each', true, false), 'sending');
  assert.equal(playStep(open, 'each', false, true), 'timed-out');
  // A send in flight keeps its chance even once the clock ran out.
  assert.equal(playStep(open, 'each', true, true), 'sending');
  const revealed = question({ answered: true, your_option_id: 3, correct_option_id: 3, is_correct: true, points: 900 });
  assert.equal(playStep(revealed, 'each', false, true), 'revealed');
  // An `end` attempt learns nothing until the results; so does an `each`
  // body that somehow lacks its verdict.
  const locked = question({ answered: true, your_option_id: 4 });
  assert.equal(playStep(locked, 'end', false, false), 'answered');
  assert.equal(playStep(locked, 'each', false, false), 'answered');
});

test('a tile paints from the server at the reveal and from the tap only while it is in flight', () => {
  const open = question();
  assert.equal(optionTileState(3, open, 'open', null), 'idle');
  assert.equal(optionTileState(3, open, 'sending', 3), 'picked');
  assert.equal(optionTileState(4, open, 'sending', 3), 'locked-other');
  assert.equal(optionTileState(3, open, 'timed-out', null), 'locked-other');
  const wrong = question({ answered: true, your_option_id: 4, correct_option_id: 3, is_correct: false, points: 0 });
  assert.equal(optionTileState(3, wrong, 'revealed', null), 'correct');
  assert.equal(optionTileState(4, wrong, 'revealed', null), 'wrong-pick');
  assert.equal(optionTileState(5, wrong, 'revealed', null), 'missed');
  // A stale local tap never colours a reveal: the server's pick does.
  assert.equal(optionTileState(5, wrong, 'revealed', 5), 'missed');
  const locked = question({ answered: true, your_option_id: 4 });
  assert.equal(optionTileState(4, locked, 'answered', null), 'picked');
  assert.equal(optionTileState(3, locked, 'answered', null), 'locked-other');
});

test('points so far are the sum of the receipts, and Finish knows how many are unanswered', () => {
  const rows = [
    question({ uuid: 'q1', position: 0, answered: true, points: 875 }),
    question({ uuid: 'q2', position: 1, answered: true, points: 0 }),
    question({ uuid: 'q3', position: 2 }),
    question({ uuid: 'q4', position: 3, answered: true, points: 500 }),
  ];
  assert.equal(attemptPoints(attempt(rows)), 1375);
  assert.equal(unansweredCount(attempt(rows)), 1);
  assert.equal(attemptPoints(attempt([question()])), 0);
  assert.ok(END_MODE_ADVANCE_MS > 0 && END_MODE_ADVANCE_MS < 1000);
});

/* ── The wiring ───────────────────────────────────────────────────────────── */

test('the clock is read in handlers and initialisers, never in render, and response_ms is monotonic', () => {
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  // The place opens lazily with both clocks, and moves on with both again.
  assert.match(play, /useState<PlayPlace>\(\(\) => \(\{\s*cursor: nextUnanswered\(attempt\) \?\? questions\.length,\s*openedAtMs: Date\.now\(\),\s*openedPerfMs: performance\.now\(\),\s*timedOut: false,\s*\}\)\)/);
  assert.match(play, /response_ms: responseMsFor\(place\.openedPerfMs, performance\.now\(\)\),/);
  // Every `Date.now()` sits inside an initialiser, a callback or an effect.
  const renderBody = play.replace(/useState<PlayPlace>\(\(\) => \([\s\S]*?\)\)/, '').replace(/useCallback\(\(\) => \{[\s\S]*?\}, \[cursor\]\)/, '').replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g, '');
  assert.doesNotMatch(renderBody, /Date\.now\(\)/);
  // Time's up is a timeout armed while the question is open, guarded by cursor.
  assert.match(play, /if \(!question \|\| step !== 'open'\) return;\s*const remaining = questionDeadlineMs\(place\.openedAtMs, question\.time_limit_seconds\) - Date\.now\(\);/);
  assert.match(play, /current\.cursor === cursor \? \{ \.\.\.current, timedOut: true \} : current/);
  // The timer leaf draws from the game clock and says Time's up at zero.
  const timer = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptTimer.tsx');
  assert.match(timer, /useServerCountdown\(/);
  assert.match(timer, /Time&rsquo;s up/);
});

test('each reveals on the receipt and waits for Next; end holds a beat and moves on, with Finish last', () => {
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  assert.match(play, /if \(step !== 'answered' \|\| isLast\) return;\s*const id = window\.setTimeout\(advance, END_MODE_ADVANCE_MS\);/);
  assert.match(play, /onClick=\{isLast \? finishNow : advance\}/);
  assert.match(play, /\{isLast \? 'See results' : 'Next question'\}/);
  assert.match(play, /onSuccess: \(\) => router\.replace\(attemptResultsHref\(attempt\.uuid\)\),/);
  // Unanswered questions are named before they are scored as wrong.
  assert.match(play, /\{unanswered\} unanswered — /);
  // The tiles are the channel game's, and the digits are scoped to the group.
  assert.match(play, /<OptionTile\s*key=\{option\.id\}/);
  assert.match(play, /role="group"\s*aria-labelledby=\{headingId\}\s*onKeyDown=\{handleKeyDown\}/);
  assert.match(play, /if \(previous !== null && previous !== cursor\) groupRef\.current\?\.focus\(\);/);
  // No toasts; a refusal is the one line under the grid.
  assert.doesNotMatch(play, /from 'sonner'/);
  assert.match(play, /setNote\(answerRefusalCopy\(status, message\)\);/);
});

test('the screen resumes from the read, sends a finished attempt to its results, and names the quiz as the way back', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlayerScreen.tsx');
  assert.match(screen, /useQuery\(soloQuizQueries\.attempt\(attemptUuid, \{ viewerId \}\)\)/);
  assert.match(screen, /if \(finished\) router\.replace\(attemptResultsHref\(attemptUuid\)\);/);
  assert.match(screen, /back: quizUuid \? \{ href: quizFrontHref\(quizUuid\), label: 'Back to the quiz' \} : null,/);
  assert.match(screen, /title="We couldn't find this attempt"/);
  const page = read('app', 'v2', 'quiz', '(solo)', 'attempts', '[attemptUuid]', '(play)', 'page.tsx');
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(read('app', 'v2', 'quiz', '(solo)', 'attempts', '[attemptUuid]', '(play)', 'loading.tsx'), /return <AttemptPlayerFallback \/>;/);
});
