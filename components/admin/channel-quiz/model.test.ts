import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANSWER_OUTCOME_LABELS,
  answerOutcome,
  durationLabel,
  exploreSection,
  nextSearch,
  parsePlayParams,
  parseQuizParams,
  percentLabel,
  playQuery,
  playStatusLabel,
  playsForQuizHref,
  quizAreaTab,
  responseTimeLabel,
  rightOfScored,
} from './model';

/* The admin "Explore quizzes (new)" tab (Stay's option A, 30 October 2026,
 * thread e80a3d30; the server's routes, Backend 8e877190 + 9c0d50da). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const UUID = '3f209b15-2406-4213-b0ba-a9fdf3f0361e';

test('a quiz page is under the new tab only inside /admin/quiz/explore', () => {
  assert.equal(quizAreaTab('/admin/quiz/explore'), 'explore');
  assert.equal(quizAreaTab('/admin/quiz/explore/plays/x'), 'explore');
  assert.equal(quizAreaTab('/admin/quiz/sessions'), 'study');
  assert.equal(quizAreaTab('/admin/quiz/questions/abc/edit'), 'study');
  assert.equal(quizAreaTab('/admin/quiz/explorer'), 'study', 'a prefix of the word is not the tab');
});

test('one play opens under Plays, one quiz under Quizzes', () => {
  assert.equal(exploreSection('/admin/quiz/explore'), 'plays');
  assert.equal(exploreSection('/admin/quiz/explore/plays/abc'), 'plays');
  assert.equal(exploreSection('/admin/quiz/explore/quizzes'), 'quizzes');
  assert.equal(exploreSection('/admin/quiz/explore/quizzes/abc'), 'quizzes');
  assert.equal(exploreSection('/admin/quiz/explore/totals'), 'totals');
});

test('the plays filters come from the URL, and anything malformed is dropped', () => {
  const params = parsePlayParams(
    new URLSearchParams(`page=2&per_page=50&quiz=${UUID}&user=not-a-uuid&status=finished&counts_for_board=0&date_from=2026-10-01&date_to=1 Oct`),
  );
  assert.deepEqual(params, {
    page: 2,
    per_page: 50,
    quiz: UUID,
    user: undefined,
    status: 'finished',
    counts_for_board: false,
    date_from: '2026-10-01',
    date_to: undefined,
  });
  const empty = parsePlayParams(new URLSearchParams('per_page=500&status=active&page=-3'));
  assert.equal(empty.per_page, 15, 'per_page out of 1 to 100 goes back to 15');
  assert.equal(empty.page, 1);
  assert.equal(empty.status, undefined);
});

test('the API gets the plays filters with dates as date_from and date_to, and booleans as 1 or 0', () => {
  const query = playQuery(parsePlayParams(new URLSearchParams(`quiz=${UUID}&counts_for_board=1&date_from=2026-10-01`)));
  assert.deepEqual(query, { page: 1, per_page: 15, quiz: UUID, counts_for_board: 1, date_from: '2026-10-01' });
});

test('the quizzes filters come from the URL', () => {
  const params = parseQuizParams(new URLSearchParams('search=  lease  &year=2025&sort=plays&include_deleted=1&visibility=public'));
  assert.equal(params.search, 'lease');
  assert.equal(params.year, 2025);
  assert.equal(params.sort, 'plays');
  assert.equal(params.include_deleted, true);
  assert.equal(params.visibility, 'public');
  assert.equal(parseQuizParams(new URLSearchParams('sort=id&year=x')).sort, undefined);
});

test('a filter change goes back to page 1, and a page change keeps the filters', () => {
  const current = new URLSearchParams('status=finished&page=3');
  assert.equal(nextSearch(current, { status: undefined }), '');
  assert.equal(nextSearch(current, { counts_for_board: true }), 'status=finished&counts_for_board=1');
  assert.equal(nextSearch(current, { page: 4 }, false), 'status=finished&page=4');
  assert.equal(playsForQuizHref(UUID), `/admin/quiz/explore?quiz=${UUID}`);
});

test('what a row says: percent, duration, status and score', () => {
  assert.equal(percentLabel(66.67), '67%');
  assert.equal(percentLabel('33.33'), '33%');
  assert.equal(percentLabel(null), '—');
  assert.equal(durationLabel(null), '—', 'an unfinished play has no length');
  assert.equal(durationLabel(42), '42s');
  assert.equal(durationLabel(125), '2m 05s');
  assert.equal(durationLabel(3720), '1h 2m');
  assert.equal(playStatusLabel(null), 'Not finished');
  assert.equal(playStatusLabel('2026-10-30T10:00:00Z'), 'Finished');
  assert.equal(rightOfScored(7, 10), '7/10');
  assert.equal(responseTimeLabel(4200), '4.2s');
  assert.equal(responseTimeLabel(null), '—');
});

test('a question in one play: removed, not answered, right or wrong', () => {
  const outcome = (removed: boolean, answered: boolean, is_correct: boolean | null) =>
    ANSWER_OUTCOME_LABELS[answerOutcome({ removed, answered, is_correct })];
  assert.equal(outcome(true, true, true), 'Question removed', 'a removed question says so whatever was answered');
  assert.equal(outcome(false, false, null), 'Not answered');
  assert.equal(outcome(false, true, true), 'Right');
  assert.equal(outcome(false, true, false), 'Wrong');
});

test('every quiz page sits under the two tabs, and the old pages keep their own code', () => {
  const area = read('app', '(admin)', 'admin', 'quiz', 'layout.tsx');
  assert.match(area, /<AdminQuizAreaTabs \/>\s*\{children\}/);
  const explore = read('app', '(admin)', 'admin', 'quiz', 'explore', 'layout.tsx');
  assert.match(explore, /<AdminExploreSectionTabs \/>\s*\{children\}/);
  const tabs = read('components', 'admin', 'channel-quiz', 'AdminQuizAreaTabs.tsx');
  assert.match(tabs, /label: 'Study quizzes \(old\)', href: STUDY_HOME/);
  assert.match(tabs, /label: 'Explore quizzes \(new\)', href: EXPLORE_BASE/);
  const nav = read('components', 'admin', 'admin-nav-quiz.tsx');
  assert.match(nav, /\{ title: 'Explore quizzes', url: '\/admin\/quiz\/explore', icon: Compass \}/);
});
