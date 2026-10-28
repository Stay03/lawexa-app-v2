import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BOARD_RULES_NOTE,
  hasFilterChoice,
  isQuizLevel,
  parseQuizListFilters,
  playerDetailLabel,
  playersLabel,
  QUIZ_LEVELS,
  quizSubjectLabel,
  rankLabel,
  readQuizYear,
  quizTagList,
  scoreLabel,
  podiumInstitution,
  standingLine,
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

test('a rank reads with its field, and a score as a whole number', () => {
  assert.equal(rankLabel(12, 128), '#12 of 128');
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

test('an Explore card is one link: the tile and title, quiet tags, the person to beat, the best', () => {
  const explore = read('explore', 'ExploreScreen.tsx');
  // No tagline over the list (Arthur, 27 October 2026: less text).
  assert.doesNotMatch(explore, /Test your knowledge/);
  // No board button on the card now (Arthur, 27 October 2026): the quiz page carries the board.
  assert.doesNotMatch(explore, /useLeaderboardOverlay|Trophy/);
  const card = read('explore', 'ExploreQuizCard.tsx');
  assert.match(card, /after:absolute after:inset-0/);
  assert.match(card, /\{leading \? 'You lead' : 'To beat'\}/);
  assert.match(card, /Be the first to play/);
  // Colour on the tile only, and no play button (Arthur, 28 October 2026).
  assert.match(card, /<QuizTile uuid=\{quiz\.uuid\} title=\{quiz\.title\} size="md" \/>/);
  assert.doesNotMatch(card, /<Play\b|QUIZ_TONE_PLAY/);
  assert.match(card, /<QuizTags quiz=\{quiz\} \/>/);
  // The best in the plain colour, and no rank on the card.
  assert.match(card, /<span className="font-comfortaa text-base font-bold text-foreground tabular-nums">\{scoreLabel\(best\)\}<\/span>/);
  assert.doesNotMatch(card, /viewer_rank\s*\?\?|rankLabel|text-\[var\(--solo-gold-text\)\]/);
});

test('the quiz page reads the board only for a public quiz, and draws the top ten', () => {
  const front = read('front', 'QuizFrontScreen.tsx');
  assert.match(front, /enabled: quiz\?\.visibility === 'public',/);
  assert.match(front, /<FrontBoard board=\{board\} \/>/);
  // The podium and the top ten, the reader's row marked and kept when further down.
  const board = read('board', 'FrontBoard.tsx');
  assert.match(board, /const BOARD_TOP = 10;/);
  assert.match(board, /const order = \[entries\[1\], entries\[0\], entries\[2\]\];/);
  assert.match(board, /\{viewer && !youShown \? \(/);
  // The place once (Stay, 28 October 2026): no #13 banner; the reader's own
  // row reads like the others, from the server's viewer.user, and their
  // standing sits under it.
  assert.doesNotMatch(board, /#\{viewer\.rank\}|>Your place</);
  assert.match(board, /const standing = viewer \? standingLine\(viewer\.players_behind, board\.player_count, viewer\.rank\) : null;/);
  assert.match(board, /const user = viewer\.user \?\? \{/);
  assert.match(board, /<YourRow viewer=\{viewer\} standing=\{standing\} \/>/);
  assert.match(board, /standing=\{isYou\(entry\) \? standing : null\}/);
  // The standing is the row's third line, so the face stays centred (Stay, 28 October 2026).
  assert.match(board, /\{note \? <span className="mt-1 text-xs leading-snug font-medium text-foreground\/75">\{note\}<\/span> : null\}/);
  // Where each player studies: the podium's short form, the rows' whole name.
  assert.match(board, /\{podiumInstitution\(entry\.user\.institution\)\}/);
  assert.match(board, /\{user\.institution \? <span className="truncate text-xs text-muted-foreground">\{user\.institution\}<\/span> : null\}/);
  // On the podium: the campus alone, and a university wrapped, never cut.
  assert.match(board, /\{podiumInstitution\(entry\.user\.institution\)\}/);
  assert.match(board, /<span className="w-full px-1 text-\[10px\] leading-tight text-balance break-words text-muted-foreground sm:text-\[11px\]">/);
  // On the page itself, no card around it, the rows split by quiet dividers (Arthur, 28 October 2026).
  assert.match(board, /aria-labelledby="quiz-front-board"\s*className="flex flex-col gap-4"\s*>/);
  assert.match(board, /<ol aria-label="Places 4 to 10" className="flex min-w-0 flex-col divide-y divide-border\/70">/);
  // One column on a computer: the quiz, one action bar, then the board, all
  // on the column's edges (Stay, 28 October 2026).
  assert.match(front, /<article className="grid grid-cols-\[minmax\(0,1fr\)\] gap-6 [^"]*md:gap-8">/);
  assert.doesNotMatch(front, /md:col-start-2|md:col-span-2|md:row-span-2/);
  assert.match(front, /md:flex-row md:items-center md:gap-4 md:rounded-2xl md:border-2/);
  assert.match(board, /<div className="mx-auto w-full min-w-0 md:max-w-lg">\s*<Podium/);
});

test('the standing line is the share of the OTHER players behind the reader, from the server’s players_behind', () => {
  // Techlead, 28 October 2026: players_behind / (player_count - 1).
  assert.equal(standingLine(15, 16, 1), 'You’re top of the board.');
  assert.equal(standingLine(7, 16, 8), 'You’re doing better than 47% of other players.');
  assert.equal(standingLine(3, 16, 13), 'You’re doing better than 20% of other players.');
  assert.equal(standingLine(7, 11, 4), 'You’re doing better than 70% of other players.');
  assert.equal(standingLine(0, 16, 16), 'Play again to climb the board.');
  // A 3- and a 2-player board.
  assert.equal(standingLine(1, 3, 2), 'You’re doing better than 50% of other players.');
  assert.equal(standingLine(1, 2, 1), 'You’re top of the board.');
  assert.equal(standingLine(0, 2, 2), 'Play again to climb the board.');
});

test('the standing line gives no percentage when there is no one to compare with', () => {
  // One player.
  assert.equal(standingLine(0, 1, 1), 'You’re the only player so far.');
  // Two players level at the top: both rank 1, neither beats anyone.
  assert.equal(standingLine(0, 2, 1), 'You’re level at the top of the board.');
  // An older server without players_behind: nothing, rather than a guess from the rank.
  assert.equal(standingLine(undefined, 16, 13), null);
  assert.equal(standingLine(null, 16, 13), null);
  // Never "better than 100%" while someone is level or ahead.
  assert.equal(standingLine(298, 300, 2), 'You’re doing better than 99% of other players.');
  // A share that rounds to 0 says climb, not "0%".
  assert.equal(standingLine(1, 400, 399), 'Play again to climb the board.');
});

test('the tags are topic, level and year, or the size when there are none', () => {
  const quiz = { topic: 'Land Law', level: '300 Level', year: 2025, question_count: 4, total_seconds: 100 };
  assert.deepEqual(quizTagList(quiz), ['Land Law', '300 Level', '2025']);
  assert.deepEqual(quizTagList(quiz, true), ['Land Law', '300 Level', '2025', '4 questions', '2 min']);
  assert.deepEqual(quizTagList({ topic: null, level: null, year: null, question_count: 1 }), ['1 question']);
});

test('the form sends topic, level and year, and clears them with null', () => {
  const form = readFileSync(join(here, '..', '..', 'channels', 'quiz', 'QuizFormDialog.tsx'), 'utf8');
  assert.match(form, /const about = \{ topic: topic\.trim\(\) \|\| null, level, year \};/);
  assert.equal(form.match(/\.\.\.about,/g)?.length, 2);
  assert.match(form, /setTopic\(loaded\.topic \?\? ''\);\s*setLevel\(loaded\.level \?\? null\);\s*setYearText\(loaded\.year \? String\(loaded\.year\) : ''\);/);
  assert.match(form, /\{QUIZ_LEVELS\.map\(\(choice\) => \(/);
});

test('the podium names a Law School campus by the campus alone, and a university in full', () => {
  assert.equal(podiumInstitution('Nigerian Law School, Enugu Campus'), 'Enugu Campus');
  assert.equal(podiumInstitution('Nigerian Law School - Abuja Campus'), 'Abuja Campus');
  assert.equal(podiumInstitution('Nigerian Law School – Lagos Campus'), 'Lagos Campus');
  assert.equal(podiumInstitution('Nigeria Law School – Kano Campus'), 'Kano Campus');
  assert.equal(podiumInstitution('The Nigerian Law School, Lagos Campus'), 'Lagos Campus');
  assert.equal(podiumInstitution('University of Nigeria, Nsukka'), 'University of Nigeria, Nsukka');
  assert.equal(podiumInstitution('Nigerian Law School'), 'Nigerian Law School');
});
