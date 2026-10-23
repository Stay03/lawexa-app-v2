import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import {
  answersCounts,
  answersDeck,
  answersPositionLabel,
  attemptAnswersHref,
  indexAfterFilter,
  openingAnswer,
  parseAnswerIndex,
  stepAnswer,
} from './results/answers-model';

/* "See your answers", one question per page (Stay, 23 October 2026, 00:03Z;
 * Arthur, 00:16Z: "one per page is better"), the practice review's stepper in
 * the attempt's shape. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const q = (uuid: string, verdict: 'right' | 'wrong' | 'skipped'): QuizAttemptQuestion => ({
  uuid,
  type: 'multiple_choice',
  question: `TEST question ${uuid}`,
  time_limit_seconds: 20,
  position: 0,
  options: [
    { id: 1, content: 'A', position: 0 },
    { id: 2, content: 'B', position: 1 },
  ],
  answered: verdict !== 'skipped',
  your_option_id: verdict === 'skipped' ? null : verdict === 'right' ? 1 : 2,
  correct_option_id: 1,
  is_correct: verdict === 'right',
  points: verdict === 'right' ? 900 : 0,
  response_ms: verdict === 'skipped' ? null : 2400,
});

// Wrong on 2 and 4, skipped on 5.
const FIVE = [q('a', 'right'), q('b', 'wrong'), q('c', 'right'), q('d', 'wrong'), q('e', 'skipped')];

test('the filters: a skipped question is one to look at again, with the wrong ones', () => {
  assert.deepEqual(answersCounts(FIVE), { all: 5, wrong: 3, right: 2 });
  assert.deepEqual(answersDeck(FIVE, 'all'), [0, 1, 2, 3, 4]);
  assert.deepEqual(answersDeck(FIVE, 'wrong'), [1, 3, 4]);
  assert.deepEqual(answersDeck(FIVE, 'right'), [0, 2]);
});

test('?q= is 1-based and only names a question the quiz has', () => {
  assert.equal(parseAnswerIndex('3', 5), 2);
  for (const bad of ['0', '6', '2.5', 'x', '', null, undefined]) assert.equal(parseAnswerIndex(bad, 5), null, String(bad));
});

test('the review opens where a link says, else on question one, else on the first wrong one of a long quiz', () => {
  assert.deepEqual(openingAnswer(FIVE, '4'), { filter: 'all', index: 3 });
  assert.deepEqual(openingAnswer(FIVE, null), { filter: 'all', index: 0 });
  const long = Array.from({ length: 21 }, (_, i) => q(`l${i}`, i === 7 ? 'wrong' : 'right'));
  assert.deepEqual(openingAnswer(long, null), { filter: 'wrong', index: 7 });
  // Twenty is not past the threshold: a 20-question quiz opens on question one.
  assert.deepEqual(openingAnswer(long.slice(0, 20), null), { filter: 'all', index: 0 });
  // An all-right long quiz has nothing to look at again.
  assert.deepEqual(openingAnswer(Array.from({ length: 21 }, (_, i) => q(`r${i}`, 'right')), null), { filter: 'all', index: 0 });
});

test('Back and Next move through the deck and stop at its ends', () => {
  const wrong = answersDeck(FIVE, 'wrong');
  assert.equal(stepAnswer(wrong, 1, 'next'), 3);
  assert.equal(stepAnswer(wrong, 3, 'prev'), 1);
  assert.equal(stepAnswer(wrong, 1, 'prev'), null);
  assert.equal(stepAnswer(wrong, 4, 'next'), null);
});

test('a filter keeps the open question when it can, else opens its first one', () => {
  assert.equal(indexAfterFilter(FIVE, 1, 'wrong'), 1);
  assert.equal(indexAfterFilter(FIVE, 0, 'wrong'), 1);
  assert.equal(indexAfterFilter(FIVE, 1, 'right'), 0);
  assert.equal(indexAfterFilter([q('x', 'right')], 0, 'wrong'), null);
});

test('"3 of 20", or "2 of 3 wrong" under a filter', () => {
  assert.equal(answersPositionLabel(answersDeck(FIVE, 'all'), 2, 'all'), '3 of 5');
  assert.equal(answersPositionLabel(answersDeck(FIVE, 'wrong'), 3, 'wrong'), '2 of 3 wrong');
  assert.equal(attemptAnswersHref('abc'), '/quiz/attempts/abc/answers');
});

test('the page: the grid, the filters, the two tiles and the Why, the bar, and a quiet ?q=', () => {
  const page = read('v2', 'features', 'quiz', 'solo', 'results', 'AnswersStepper.tsx');
  // The open question's number in the address, written quietly and in place.
  assert.match(page, /quietReplaceUrlParams\(\{ q: String\(index \+ 1\) \}\);/);
  assert.match(page, /const \[opening\] = useState\(\(\) => openingAnswer\(questions, searchParams\.get\('q'\)\)\);/);
  // The grid names each verdict, and the open cell is outlined, not a third colour.
  assert.match(page, /aria-label=\{`Question \$\{index \+ 1\}, \$\{VERDICT_WORD\[verdict\]\}`\}/);
  assert.match(page, /open && 'ring-2 ring-foreground ring-offset-1 ring-offset-background'/);
  // Only the tiles that matter: your wrong pick, then the right answer, as played.
  assert.match(page, /\{picked \? <AttemptOptionTile index=\{0\} content=\{picked\.content\} look="card" state="wrong-pick" \/> : null\}/);
  assert.match(page, /\{right \? <AttemptOptionTile index=\{1\} content=\{right\.content\} look="card" state="correct" \/> : null\}/);
  // Back · "3 of 20" · Next, and Done at the end, back to the results.
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(page, /\{answersPositionLabel\(deck, current, filter\)\}/);
  assert.match(page, /<Link href=\{`\/quiz\/attempts\/\$\{attempt\.uuid\}\/results`\}>Done<\/Link>/);
  // The arrow keys yield to text entry and to anything open on top.
  assert.match(page, /target\?\.closest\('\[role="dialog"\], \[role="alertdialog"\], \[role="menu"\], \[role="listbox"\]'\)/);

  const screen = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptAnswersScreen.tsx');
  assert.match(screen, /soloQuizQueries\.attempt\(attemptUuid, \{ viewerId \}\)/);
  assert.match(screen, /if \(unfinished\) router\.replace\(attemptHref\(attemptUuid\)\);/);
  assert.match(screen, /<Suspense fallback=\{<AttemptAnswersSkeleton \/>\}>/);
  const route = read('app', 'v2', 'quiz', '(solo)', 'attempts', '[attemptUuid]', 'answers', 'page.tsx');
  assert.match(route, /robots: \{ index: false, follow: false \}/);
  assert.match(route, /<AttemptAnswersScreen attemptUuid=\{attemptUuid\} \/>/);
});

test('the tabs sit above the numbers, and the numbers are the open tab\'s, each keeping its quiz number (Stay, 23 October 2026, 09:25Z)', () => {
  const page = read('v2', 'features', 'quiz', 'solo', 'results', 'AnswersStepper.tsx');
  // The filter first, then the list it filters.
  assert.ok(page.indexOf('aria-label="Show"') < page.indexOf('<AnswerGrid'), 'the tabs before the numbers');
  assert.match(page, /<AnswerGrid questions=\{questions\} deck=\{deck\} current=\{current\} onJump=\{jumpTo\} \/>/);
  // Only the open tab's questions, by their place in the quiz.
  assert.match(page, /\{deck\.map\(\(index\) => \{\s*const question = questions\[index\];/);
  assert.match(page, /\{index \+ 1\}\s*<\/button>/);
  // A jump stays in the tab: nothing widens it to All any more.
  assert.doesNotMatch(page, /setFilter\('all'\)/);
  // Under Wrong on FIVE (wrong on 2 and 4, skipped 5) the row holds 2, 4 and 5.
  assert.deepEqual(answersDeck(FIVE, 'wrong').map((index) => index + 1), [2, 4, 5]);
  assert.deepEqual(answersDeck(FIVE, 'right').map((index) => index + 1), [1, 3]);
});
