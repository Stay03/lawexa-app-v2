import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  QUIZ_TONES,
  bestLabel,
  bestOrNotTaken,
  quizFactsLabel,
  quizInitial,
  quizMinutesLabel,
  quizTone,
  scenarioCountLabel,
} from './rows-model';

/* Quiz piece 2, version C (Stay, 23 October 2026: "let's do C"): small cards,
 * two across on a phone and four on a computer, each with one fact line and
 * the reader's best or "Not taken". */

const here = dirname(fileURLToPath(import.meta.url));

test('the minutes round up from the summed timers, at least one, and are absent without the field', () => {
  assert.equal(quizMinutesLabel(60), 'about 1 min');
  assert.equal(quizMinutesLabel(150), 'about 3 min');
  assert.equal(quizMinutesLabel(20), 'about 1 min');
  assert.equal(quizMinutesLabel(0), null);
  assert.equal(quizMinutesLabel(undefined), null);
});

test('the fact line is the count and the minutes, or the count alone', () => {
  assert.equal(quizFactsLabel(10, 290), '10 questions · 5 min');
  assert.equal(quizFactsLabel(1, 30), '1 question · 1 min');
  assert.equal(quizFactsLabel(6, undefined), '6 questions');
});

test('the quiz front still counts its scenarios', () => {
  assert.equal(scenarioCountLabel(1), '1 scenario');
  assert.equal(scenarioCountLabel(2), '2 scenarios');
  assert.equal(scenarioCountLabel(0), null);
  assert.equal(scenarioCountLabel(undefined), null);
});

test('the best is said when there is one, "Not taken" only to an account the server says has none', () => {
  assert.equal(bestLabel(2553), 'Best 2,553');
  assert.equal(bestLabel(0), 'Best 0');
  assert.equal(bestLabel(null), null);
  assert.deepEqual(bestOrNotTaken(4210, true), { label: 'Best 4,210', taken: true });
  assert.deepEqual(bestOrNotTaken(null, true), { label: 'Not taken', taken: false });
  // Signed out there is no one to have taken it, and a server that does not
  // send the field says nothing either way.
  assert.equal(bestOrNotTaken(null, false), null);
  assert.equal(bestOrNotTaken(undefined, true), null);
});

test('the tile is the same colour for the same quiz, and its letter is the first one in the title', () => {
  assert.equal(quizTone('050f4b4f-3639-49d0-8d15-97570d5bcd4d'), quizTone('050f4b4f-3639-49d0-8d15-97570d5bcd4d'));
  assert.ok(QUIZ_TONES.includes(quizTone('a')));
  assert.equal(quizInitial('land law problems'), 'L');
  assert.equal(quizInitial('"Contract" basics'), 'C');
  assert.equal(quizInitial('…'), 'Q');
});

test('My quizzes draws the shared card with its menu; Explore draws its own B1 card', () => {
  const card = readFileSync(join(here, 'QuizCard.tsx'), 'utf8');
  assert.match(card, /export const QUIZ_CARD_GRID = 'grid grid-cols-2 gap-2\.5 sm:grid-cols-3 xl:grid-cols-4';/);
  // The menu is a sibling above the stretched link, never inside it.
  assert.match(card, /\{menu \? <div className="relative z-10 -mr-1\.5">\{menu\}<\/div> : null\}\s*<\/div>\s*<Link/);
  assert.match(card, /after:absolute after:inset-0/);
  // The footer replaces the best on both tabs: Explore's board lines and
  // Take quiz; My quizzes' visibility beside the best (Arthur, 25 October 2026).
  assert.match(card, /\{footer !== undefined \? \(\s*<div className="mt-auto flex min-w-0 flex-col gap-1 pt-1">\{footer\}<\/div>\s*\) : best \? \(/);
  const library = readFileSync(join(here, 'library', 'LibraryScreen.tsx'), 'utf8');
  assert.match(library, /className=\{cn\(\s*QUIZ_CARD_GRID,/);
  assert.match(library, /<QuizCard\s*quiz=\{quiz\}\s*index=\{index\}\s*signedIn\s*subject=\{quizSubjectLabel\(quiz\)\}\s*players=\{playersLabel\(quiz\.leaderboard\?\.player_count\)\}\s*menu=\{menu\}\s*footer=\{footer\}\s*>/);
  assert.match(library, /\{visibilityFace\(quiz\.visibility\)\}/);
  assert.doesNotMatch(library, /editedLabel/);
  const explore = readFileSync(join(here, 'explore', 'ExploreScreen.tsx'), 'utf8');
  assert.match(explore, /className=\{cn\(\s*EXPLORE_CARD_GRID,/);
  assert.doesNotMatch(explore, /<QuizCard/);
  const exploreCard = readFileSync(join(here, 'explore', 'ExploreQuizCard.tsx'), 'utf8');
  assert.match(exploreCard, /export const EXPLORE_CARD_GRID = 'v2-solo grid grid-cols-1 gap-4 pb-1 sm:grid-cols-2 xl:grid-cols-3';/);
  const home = readFileSync(join(here, '..', 'home', 'QuizHomeScreen.tsx'), 'utf8');
  assert.match(home, /const HOME_COLUMN = cn\(LIST_COLUMN, 'max-w-5xl'\);/);
});
