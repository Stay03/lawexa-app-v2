import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The explore page (/quiz/explore, 21 October 2026): every public quiz, for
 * anyone, signed out included. Pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the explore list is fetched for everyone and opens each quiz on its front', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'explore', 'ExploreScreen.tsx');
  // Unconditional: no `enabled`, no sign-in branch, no guest-pass wait.
  assert.match(screen, /useInfiniteQuery\(\{\s*\.\.\.soloQuizQueries\.explore\(\{ viewerId \}\),/);
  // The rows stay on screen across the visitor-to-guest key change.
  assert.match(screen, /placeholderData: keepPreviousData,/);
  assert.doesNotMatch(screen, /enabled:/);
  assert.doesNotMatch(screen, /signedIn|useGuestPassFailed|SignedOutState/);
  assert.match(screen, /href=\{quizFrontHref\(quiz\.uuid\)\}/);
  // The author has the card's last line, and a gone account is a word, not a crash.
  assert.match(screen, /<MemberAvatar user=\{quiz\.creator\} className="size-5" \/>/);
  assert.match(screen, /quiz\.creator\?\.name \?\? 'Someone who has left'/);
  assert.match(screen, /rootRef: scrollRootRef,/);
  // A tab of the Quiz home now: no page column and no heading of its own.
  assert.match(screen, /export function ExploreList\(\) \{/);
  assert.doesNotMatch(screen, /LIST_COLUMN|<h1/);
});

test('the old Explore address lands on the home, which carries the public treatment', () => {
  assert.match(read('app', 'v2', 'quiz', 'explore', 'page.tsx'), /redirect\(EXPLORE_HREF\);/);
  const home = read('app', 'v2', 'quiz', '(home)', 'page.tsx');
  assert.match(home, /const canonical = `\$\{getAppUrl\(\)\.replace\(\/\\\/\$\/, ''\)\}\/quiz`;/);
  assert.match(home, /alternates: \{ canonical \}/);
  assert.match(home, /robots: \{ index: true, follow: true \}/);
  assert.match(home, /openGraph: \{/);
});
