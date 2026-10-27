import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BOARD_RULES_NOTE,
  cardBoardLines,
  hasBoard,
  hasFilterChoice,
  isQuizLevel,
  parseQuizListFilters,
  playerDetailLabel,
  playersLabel,
  QUIZ_LEVELS,
  quizSubjectLabel,
  rankLabel,
  readQuizYear,
  scoreLabel,
} from './home-model';

/* Arthur's quiz home redesign (25 October 2026), parts C and D, on Backend's
 * quiz list parts 5 (filters) and 6 (leaderboard), branch quiz-filters at
 * c63a7064: the filters in the address, what a card says about its board,
 * and the year the form takes. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const params = (query: string) => new URLSearchParams(query);

test('the levels are the sign-up list plus law school and lawyer, in one place', () => {
  assert.deepEqual(
    [...QUIZ_LEVELS],
    ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', '600 Level', 'Law School', 'Lawyer'],
  );
  assert.equal(isQuizLevel('300 Level'), true);
  // Spelt exactly as the server stores it.
  assert.equal(isQuizLevel('300 level'), false);
  assert.equal(isQuizLevel(null), false);
});

test('the address names the filters, and a value the server would refuse is dropped', () => {
  assert.deepEqual(parseQuizListFilters(params('')), {});
  assert.deepEqual(
    parseQuizListFilters(params('search=%20tort%20&year=2019&level=Law+School&topic=Land+Law')),
    { search: 'tort', year: 2019, level: 'Law School', topic: 'Land Law' },
  );
  // Not a whole year, before 1960, an unknown level, a blank topic.
  assert.deepEqual(parseQuizListFilters(params('year=19&level=PhD&topic=%20%20')), {});
  assert.deepEqual(parseQuizListFilters(params('year=1959')), {});
  assert.deepEqual(parseQuizListFilters(params('year=2019x')), {});
  // The server takes a search of at most 100 characters.
  assert.equal(parseQuizListFilters(params(`search=${'a'.repeat(140)}`)).search?.length, 100);
  // A topic filter of up to 255 characters; past that it is dropped.
  assert.equal(parseQuizListFilters(params(`topic=${'b'.repeat(256)}`)).topic, undefined);
  assert.equal(hasFilterChoice({ search: 'x' }), false);
  assert.equal(hasFilterChoice({ year: 2020 }), true);
  assert.equal(hasFilterChoice({ topic: 'Evidence' }), true);
});

test('a card says what the quiz is about and how many have played', () => {
  assert.equal(quizSubjectLabel({ topic: 'Land Law', level: '300 Level', year: 2025 }), 'Land Law · 300 Level · 2025');
  assert.equal(quizSubjectLabel({ topic: '  ', level: null, year: 2024 }), '2024');
  assert.equal(quizSubjectLabel({}), null);
  assert.equal(playersLabel(1), '1 player');
  assert.equal(playersLabel(1280), '1,280 players');
  assert.equal(playersLabel(0), null);
  assert.equal(playersLabel(undefined), null);
});

test('the score to beat and the reader’s own place are two separate lines', () => {
  assert.deepEqual(
    cardBoardLines({ player_count: 128, top: { name: 'Ada', avatar_url: null, points: 11405 }, viewer_rank: 12 }),
    { toBeat: { name: 'Ada', points: '11,405' }, yourRank: '#12 of 128' },
  );
  // No one has finished; the reader has not.
  assert.deepEqual(cardBoardLines({ player_count: 0, top: null, viewer_rank: null }), { toBeat: null, yourRank: null });
  // Not on the public list.
  assert.deepEqual(cardBoardLines(null), { toBeat: null, yourRank: null });
  assert.equal(hasBoard({ player_count: 3, top: null, viewer_rank: null }), true);
  assert.equal(hasBoard({ player_count: 0, top: null, viewer_rank: null }), false);
  assert.equal(hasBoard(null), false);
  // A count that has not caught up with the rank is left out.
  assert.equal(rankLabel(5, 4), '#5');
  assert.equal(rankLabel(3), '#3');
  assert.equal(scoreLabel(1820.4), '1,820');
});

test('the board says how it ranks, and a player row shows only what was sent', () => {
  assert.match(BOARD_RULES_NOTE, /best score/);
  assert.match(BOARD_RULES_NOTE, /friendly benchmark/);
  assert.equal(playerDetailLabel({ institution: 'Lagos campus', level: 'Law School' }), 'Lagos campus · Law School');
  assert.equal(playerDetailLabel({ level: '300 Level' }), '300 Level');
  assert.equal(playerDetailLabel({}), null);
});

test('the form takes an empty year or a whole year in the server’s range', () => {
  assert.deepEqual(readQuizYear('', 2027), { year: null, problem: null });
  assert.deepEqual(readQuizYear(' 2019 ', 2027), { year: 2019, problem: null });
  assert.equal(readQuizYear('1959', 2027).problem, 'The year must be from 1960 to 2027, such as 2019.');
  assert.equal(readQuizYear('2028', 2027).year, null);
  assert.equal(readQuizYear('19', 2027).year, null);
});

test('both lists read their filters from the address and draw the same bar', () => {
  for (const screen of [read('explore', 'ExploreScreen.tsx'), read('library', 'LibraryScreen.tsx')]) {
    assert.match(screen, /const search = useUrlSearch\('search'\);/);
    assert.match(screen, /const filters = parseQuizListFilters\(useSearchParams\(\)\);/);
    assert.match(screen, /<QuizFilters search=\{search\} filters=\{filters\} options=\{pages\?\.\[0\]\?\.filters\} \/>/);
    // A filter that leaves nothing says so, with a way back.
    assert.match(screen, /showEmpty && narrowed \? \(/);
    assert.match(screen, /replaceUrlParams\(NO_QUIZ_FILTERS\);/);
  }
  const home = read('..', 'home', 'QuizHomeScreen.tsx');
  // A tab starts with no choice set.
  assert.match(home, /replaceUrlParams\(\{ \.\.\.NO_QUIZ_FILTERS, tab: next === 'explore' \? null : next \}\);/);
  const bar = read('..', 'home', 'QuizFilters.tsx');
  assert.match(bar, /<SearchField\s*value=\{search\.inputValue\}/);
  assert.match(bar, /<SelectContent position="popper"/);
  // The choices are the server's, levels in the list's order.
  assert.match(bar, /const levels = QUIZ_LEVELS\.filter\(/);
});

test('an Explore card keeps Take quiz the main action and opens the board from its corner', () => {
  const explore = read('explore', 'ExploreScreen.tsx');
  assert.match(explore, /Test your knowledge, learn something new and track your progress\./);
  assert.match(explore, /const corner = hasBoard\(quiz\.leaderboard\) \? \(/);
  assert.match(explore, /aria-label=\{`Leaderboard for \$\{quiz\.title\}`\}/);
  assert.match(explore, /onClick=\{\(\) => onOpenBoard\(quiz\.uuid, quiz\.title\)\}/);
  // Take quiz is the card's face, hidden from a screen reader, which hears the title link.
  assert.match(explore, /<span\s*aria-hidden\s*className="[^"]*"\s*>\s*Take quiz\s*<\/span>/);
  const card = read('QuizCard.tsx');
  assert.match(card, /<BadgeCheck aria-hidden className="size-3\.5 shrink-0 text-primary" \/>\s*<span className="sr-only">, verified author<\/span>/);
});

test('the board opens at its own address, and the quiz page reads it only for a public quiz', () => {
  const overlay = read('board', 'use-leaderboard-overlay.tsx');
  assert.match(overlay, /const BOARD_PARAM = 'board';/);
  assert.match(overlay, /key=\{overlay\.keyFor\(quizUuid\)\}/);
  const front = read('front', 'QuizFrontScreen.tsx');
  assert.match(front, /enabled: quiz\?\.visibility === 'public',/);
  assert.match(front, /<FrontBoard board=\{board\} onSeeAll=\{\(\) => openBoard\(quiz\.uuid, quiz\.title\)\} \/>/);
  assert.match(front, /Your rank \{rank\}/);
  const sheet = read('board', 'QuizLeaderboardSheet.tsx');
  assert.match(sheet, /enabled: open,/);
  assert.match(sheet, /extractApiError\(query\.error\)\.status === 404/);
});

test('the form sends topic, level and year, and clears them with null', () => {
  const form = readFileSync(join(here, '..', '..', 'channels', 'quiz', 'QuizFormDialog.tsx'), 'utf8');
  assert.match(form, /const about = \{ topic: topic\.trim\(\) \|\| null, level, year \};/);
  assert.equal(form.match(/\.\.\.about,/g)?.length, 2);
  assert.match(form, /setTopic\(loaded\.topic \?\? ''\);\s*setLevel\(loaded\.level \?\? null\);\s*setYearText\(loaded\.year \? String\(loaded\.year\) : ''\);/);
  assert.match(form, /\{QUIZ_LEVELS\.map\(\(choice\) => \(/);
});
