import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMigratedToV2 } from '@/v2/routes.manifest';
import { pushedScreenFor } from '@/v2/shell/pushed-route';
import { EXPLORE_HREF, LIBRARY_HREF } from './model';

/* The solo quiz routes (21 October 2026): fixed prefixes under /quiz beside
 * the practice player, a split gate so Explore and a quiz's front render
 * signed out, and back links decided by the address. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');
const exists = (...parts: string[]) => existsSync(join(process.cwd(), ...parts));

test('every solo address is rewritten into the v2 tree', () => {
  for (const path of ['/quiz/library', '/quiz/explore', '/quiz/q/abc', '/quiz/attempts/abc', '/quiz/attempts/abc/results', '/quiz/attempts/abc/answers']) {
    assert.equal(isMigratedToV2(path), true, path);
  }
});

test('the two lists are the Quiz home\'s tabs, a top-level screen, not pushed ones', () => {
  assert.equal(LIBRARY_HREF, '/quiz?tab=mine');
  assert.equal(EXPLORE_HREF, '/quiz');
  assert.equal(pushedScreenFor('/quiz/library'), null);
  assert.equal(pushedScreenFor('/quiz/explore'), null);
});

test("a quiz's front keeps its title in the page and its chevron means out", () => {
  assert.deepEqual(pushedScreenFor('/quiz/q/abc'), {
    backHref: '/quiz',
    backLabel: 'Back to Quiz',
    title: { kind: 'none' },
    reach: 'anywhere',
  });
  assert.equal(pushedScreenFor('/quiz/q'), null);
  assert.equal(pushedScreenFor('/quiz/q/abc/more'), null);
});

test('an attempt and its results default to the hub until the screen names the quiz', () => {
  assert.deepEqual(pushedScreenFor('/quiz/attempts/abc'), {
    backHref: '/quiz',
    backLabel: 'Back to Quiz',
    title: { kind: 'none' },
  });
  assert.deepEqual(pushedScreenFor('/quiz/attempts/abc/results'), {
    backHref: '/quiz',
    backLabel: 'Back to Quiz',
    title: { kind: 'fixed', text: 'Results' },
  });
  // "See your answers" goes back to its own results; the page prints its heading.
  assert.deepEqual(pushedScreenFor('/quiz/attempts/abc/answers'), {
    backHref: '/quiz/attempts/abc/results',
    backLabel: 'Back to your results',
    title: { kind: 'none' },
  });
  assert.equal(pushedScreenFor('/quiz/attempts'), null);
  assert.equal(pushedScreenFor('/quiz/attempts/abc/other'), null);
  // The practice routes are unchanged.
  assert.equal(pushedScreenFor('/quiz/history')?.title.kind, 'fixed');
  assert.equal(pushedScreenFor('/quiz/abc'), null);
});

test('the solo group keeps its gate, practice is hidden behind a redirect, the home has none', () => {
  assert.ok(!exists('app', 'v2', 'quiz', 'layout.tsx'), 'no gate over the whole segment');
  assert.match(read('app', 'v2', 'quiz', '(solo)', 'layout.tsx'), /<QuizAccessGate surface="solo">\{children\}<\/QuizAccessGate>/);
  // Practice is hidden (Stay, 23 October 2026): one layout sends every
  // practice address home, and its pages stay for when it comes back.
  assert.match(read('app', 'v2', 'quiz', '(practice)', 'layout.tsx'), /redirect\('\/quiz'\);/);
  for (const route of ['[sessionUuid]/(play)/page.tsx', 'history/page.tsx', 'stats/page.tsx', 'play/page.tsx']) {
    assert.ok(exists('app', 'v2', 'quiz', '(practice)', route), route);
  }
  assert.ok(!exists('app', 'v2', 'quiz', '(practice)', '(hub)', 'page.tsx'), '/quiz is the home now');
  assert.ok(exists('app', 'v2', 'quiz', '(home)', 'page.tsx'));
  const gate = read('v2', 'features', 'quiz', 'access.tsx');
  // Neutral words on the solo surface, the practice words kept for practice.
  assert.match(gate, /surface === 'solo' \? \(\s*<SoloSignedOutState signInHref=\{signIn\} \/>\s*\) : \(\s*<QuizSignedOutState signInHref=\{signIn\} \/>/);
  assert.match(gate, /surface === 'solo' \? \(\s*<SoloCreateAccountState signInHref=\{signIn\} \/>\s*\) : \(\s*<QuizCreateAccountState \/>/);
  // The guest pass is awaited before the sign-in door, so one visitor never
  // meets two panels; the way in returns to the address they were on.
  assert.match(gate, /if \(!guestPassFailed\) return <QuizSegmentFallback \/>;/);
  assert.match(gate, /const signIn = signInHref\(pathname\);/);
  // The copy itself (comments stripped) never speaks of practising.
  const solo = read('v2', 'features', 'quiz', 'solo', 'states.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(solo, /practis/i);
  assert.match(solo, /title="Sign in to continue"/);
});

test('the API client does not bounce the two public quiz pages to /login', () => {
  const client = read('lib', 'api', 'client.ts');
  assert.match(client, /window\.location\.pathname\.startsWith\('\/quiz\/explore'\) \|\|\s*window\.location\.pathname\.startsWith\('\/quiz\/q\/'\)/);
});

test('the hub links to the library and to Explore, in the live screen and in its fallback', () => {
  const hub = read('v2', 'features', 'quiz', 'hub', 'QuizHubScreen.tsx');
  assert.match(hub, /href=\{LIBRARY_HREF\}/);
  assert.match(hub, /href=\{EXPLORE_HREF\}/);
  assert.equal(hub.match(/<SoloDoors \/>/g)?.length, 2);
});
