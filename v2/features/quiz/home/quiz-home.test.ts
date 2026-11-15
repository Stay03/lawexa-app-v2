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
  assert.match(screen, /\{canWrite \? \(\s*<JoinOrCreateMenu onJoin=\{\(\) => setCodeOpen\(true\)\} onCreate=\{\(\) => openForm\(\)\} \/>/);
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

/* Option 1a (Stay, 15 November 2026, 18:19Z): one + for Join and Create on
 * the title line; under it a row of the live public games, gone when none. */
const row = readFileSync(join(here, 'LiveNowRow.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('Enter code opens the code sheet, and a code that finds a game opens that game', () => {
  // The + menu's "Join with a code" opens the sheet the home holds.
  assert.match(row, /<DropdownMenuItem onSelect=\{onJoin\}[^>]*>\s*<Hash aria-hidden[^>]*\/>\s*Join with a code/);
  assert.match(row, /aria-label="Join or create a quiz"/);
  assert.match(screen, /\{canWrite \? <CodeSheet open=\{codeOpen\} onOpenChange=\{setCodeOpen\} \/> : null\}/);
  // A sheet on a phone, a centred dialog on a computer (the app's overlay), with one field and Join game.
  assert.match(row, /<ResponsiveOverlay\s+open=\{open\}\s+onOpenChange=\{onOpenChange\}\s+size="content"\s+title="Join a game"/);
  assert.match(row, /aria-label="Join code"/);
  assert.match(row, /Join game\s*<\/RaisedButton>/);
  // A code the server finds opens its game; one it does not, or that is not a code, says so in one sentence.
  assert.match(row, /lookup\.mutate\(normalized, \{\s*onSuccess: \(response\) => router\.push\(openGameHref\(response\.data\.uuid\)\),\s*onError: \(failure\) => setError\(codeRefusal\(extractApiError\(failure\)\.status\)\),/);
  assert.match(row, /if \(!isJoinCode\(normalized\)\) \{\s*setError\(NO_GAME_FOR_CODE\);/);
  // Each live game is one link into it, its title and players read out.
  assert.match(row, /href=\{openGameHref\(game\.uuid\)\}\s*aria-label=\{`\$\{liveGameAction\(game\)\} \$\{game\.quiz\.title\}, \$\{liveGameState\(game\)\}, \$\{game\.player_count\} playing`\}/);
});

test('with no live game there is no row at all; the + menu is the only Join and the only Create', () => {
  // Nothing live, or not read yet: no row, and no line saying "none".
  assert.match(row, /if \(games\.length === 0\) return null;/);
  assert.doesNotMatch(row, /No live games right now|Enter a game code/);
  // Create is the + menu's second item, and the screen has no other create button.
  assert.match(row, /<DropdownMenuItem onSelect=\{onCreate\}[^>]*>\s*<Plus aria-hidden[^>]*\/>\s*Create a quiz/);
  assert.doesNotMatch(screen, /CREATE_PILL|aria-label="Create quiz"/);
});
