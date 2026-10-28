import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseQuizHomeTab } from './quiz-home-tab';
import { topLevelScreenFor } from '../../../shell/top-level-route';

/* Stay, 23 October 2026, on the quiz pictures: "Should be tabs discover/explore
 * and my quiz", and the practice quiz hidden until it is reworked. */

const here = dirname(fileURLToPath(import.meta.url));
const screen = readFileSync(join(here, 'QuizHomeScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('the tab is the query string: My quizzes on ?tab=mine, Explore for anything else', () => {
  assert.equal(parseQuizHomeTab('mine'), 'mine');
  assert.equal(parseQuizHomeTab(null), 'explore');
  assert.equal(parseQuizHomeTab('explore'), 'explore');
  assert.equal(parseQuizHomeTab('history'), 'explore');
});

test('the home is a top-level screen titled Quiz, Explore first', () => {
  assert.deepEqual(topLevelScreenFor('/quiz'), { title: 'Quiz' });
  const tabs = readFileSync(join(here, 'QuizHomeTabs.tsx'), 'utf8');
  assert.ok(tabs.indexOf("label: 'Explore'") < tabs.indexOf("label: 'My quizzes'"));
});

test('Explore renders for anyone; My quizzes says the solo refusals; Create quiz on both tabs, for a writer only', () => {
  assert.match(screen, /\{tab === 'explore' \? \(\s*<ExploreList \/>\s*\) : canWrite \? \(\s*<LibraryList openForm=\{openForm\} \/>/);
  assert.match(screen, /!signedIn && !guestPassFailed \? \(\s*<LibraryListSkeleton \/>/);
  assert.match(screen, /<SoloSignedOutState signInHref=\{signInHref\(`\$\{pathname\}\?tab=mine`\)\} \/>/);
  assert.match(screen, /<SoloCreateAccountState signInHref=\{signInHref\(`\$\{pathname\}\?tab=mine`\)\} \/>/);
  // Stay, 23 October 2026: "Both". Not gated on the tab, only on who may write.
  assert.match(screen, /\{canWrite \? \(\s*<button/);
  assert.doesNotMatch(screen, /tab === 'mine' && canWrite/);
  assert.match(screen, /const canWrite = signedIn && canAccessQuizPlayer\(role\);/);
});

test('an "Only you" quiz says why there is no Challenge, with the way to change it', () => {
  const actions = readFileSync(join(here, '..', 'solo', 'results', 'ResultsActions.tsx'), 'utf8');
  assert.match(actions, /\{privateQuiz && !shareable \? \(/);
  assert.match(actions, /Only you can take this quiz\.\{' '\}/);
  assert.match(actions, /Change who can take it/);
  const results = readFileSync(join(here, '..', 'solo', 'results', 'AttemptResultsScreen.tsx'), 'utf8');
  assert.match(results, /privateQuiz=\{visibility === 'private'\}/);
});
