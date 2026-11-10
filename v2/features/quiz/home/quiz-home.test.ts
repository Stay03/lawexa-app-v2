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

/* Challenge a Friend is one tap (Arthur, 10 November 2026; decision e): on the
 * author's own "Only you" quiz, or one shared with a Space, the tap switches it
 * to "Anyone with the link" and opens sharing at once, with no settings screen. */
test('Challenge a friend is one tap: who gets it, and what the tap does', async () => {
  const { challengeReach } = await import('../solo/challenge-reach');
  // A link opens it: the tap shares.
  assert.equal(challengeReach('link', false), 'share');
  assert.equal(challengeReach('public', true), 'share');
  // The author's own quiz no link opens yet: the tap opens it to the link and shares.
  assert.equal(challengeReach('private', true), 'open-and-share');
  assert.equal(challengeReach('shared', true), 'open-and-share');
  // Anyone else on such a quiz, or a quiz still loading: no Challenge.
  assert.equal(challengeReach('private', false), null);
  assert.equal(challengeReach('shared', false), null);
  assert.equal(challengeReach(null, true), null);

  const hook = readFileSync(join(here, '..', 'solo', 'use-challenge-friend.ts'), 'utf8');
  // The switch and the sheet in the same tap: a phone opens the sheet only from the tap itself.
  assert.match(hook, /if \(reach === 'open-and-share'\) openToLink\.mutate\('link'\);\s*void share\.share\(\);/);
  assert.match(hook, /openFailed: openToLink\.isError/);
  // No settings detour any more; a failed switch says so in place, on both screens.
  const actions = readFileSync(join(here, '..', 'solo', 'results', 'ResultsActions.tsx'), 'utf8');
  assert.doesNotMatch(actions, /Change who can take it/);
  assert.match(actions, /\{friend\.openFailed \? \(\s*<p\s+role="alert"/);
  const front = readFileSync(join(here, '..', 'solo', 'front', 'QuizFrontScreen.tsx'), 'utf8');
  assert.match(front, /\{challenge\.openFailed && \(\s*<p role="alert"/);
  assert.match(front, /isMine: query\.data\?\.data\?\.is_mine === true,/);
  const results = readFileSync(join(here, '..', 'solo', 'results', 'AttemptResultsScreen.tsx'), 'utf8');
  assert.match(results, /const isMine = detailQuery\.data\?\.data\.is_mine === true;/);
});
