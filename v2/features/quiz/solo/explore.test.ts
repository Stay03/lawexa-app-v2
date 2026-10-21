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
  assert.match(screen, /useInfiniteQuery\(soloQuizQueries\.explore\(\{ viewerId \}\)\)/);
  assert.doesNotMatch(screen, /enabled:/);
  assert.doesNotMatch(screen, /signedIn|useGuestPassFailed|SignedOutState/);
  assert.match(screen, /href=\{quizFrontHref\(quiz\.uuid\)\}/);
  // The author leads the row, and a gone account is a word, not a crash.
  assert.match(screen, /<MemberAvatar user=\{quiz\.creator\} className="mt-0\.5" \/>/);
  assert.match(screen, /quiz\.creator\?\.name \?\? 'Someone who has left'/);
  assert.match(screen, /rootRef: scrollRootRef,/);
  assert.match(screen, /<ExploreHeading \/>\s*<ExploreListSkeleton \/>/);
});

test('the route is public: canonical, OG card, indexable, and under no gate', () => {
  const page = read('app', 'v2', 'quiz', 'explore', 'page.tsx');
  assert.match(page, /const canonical = `\$\{getAppUrl\(\)\.replace\(\/\\\/\$\/, ''\)\}\/quiz\/explore`;/);
  assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /robots: \{ index: true, follow: true \}/);
  assert.match(page, /openGraph: \{/);
  assert.match(read('app', 'v2', 'quiz', 'explore', 'loading.tsx'), /return <ExploreFallback \/>;/);
});
