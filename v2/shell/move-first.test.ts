import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for move-first (move-first.tsx). Painting cannot run under node:test;
// the before/after table and the trace are in the commit. This pins the order
// that makes the move paint before any route work, and the wiring around it.
const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const moveFirst = read('move-first.tsx');
const motion = read('route-motion.tsx');
const css = read('shell.css');
const row = read('..', 'features', 'conversations', 'list', 'ConversationRow.tsx');
const layout = read('..', '..', 'app', 'v2', 'layout.tsx');

test('the frame commits in the click, the navigation starts after a painted frame', () => {
  const flush = moveFirst.indexOf('flushSync(() => {');
  const raf = moveFirst.indexOf('requestAnimationFrame(() => {', flush);
  const task = moveFirst.indexOf('window.setTimeout(() => {', raf);
  const start = moveFirst.indexOf('startNavigation(() => {', task);
  const push = moveFirst.indexOf('router.replace(href);', start);
  assert.ok(flush > 0 && raf > flush && task > raf && start > task && push > start, 'order');
});

test('the layer shows while painting or while the navigation is pending, never after', () => {
  assert.match(moveFirst, /const visible = pending !== null && \(pending\.phase === 'painting' \|\| navigating\);/);
  assert.match(moveFirst, /\{ \.\.\.current, phase: 'navigating' \}/);
});

test('a plain click is taken over; the same page and no provider keep the default', () => {
  assert.match(moveFirst, /if \(!navigate \|\| pathOf\(href\) === pathname\) return;\s*event\.preventDefault\(\);\s*navigate\(href, kind, title, header\);/);
});

test('the real screen does not slide in again after the layer made the move', () => {
  assert.match(moveFirst, /skipRouteEntranceFor\(pathOf\(href\)\);/);
  assert.match(motion, /export function skipRouteEntranceFor\(pathname: string\): void/);
  assert.match(motion, /if \(entrancePlayedFor === pathname\) \{/);
  assert.match(css, /html\.v2-document-lock \.v2-move-first \{\s*animation: v2-move-first-enter /);
});

test('chat rows move first with the conversation frame, under the v2 provider', () => {
  assert.match(row, /<MoveFirstLink\s+href=\{`\/c\/\$\{id\}`\}\s+kind="conversation"/);
  assert.match(layout, /<MoveFirstProvider>/);
  assert.match(moveFirst, /conversation: ConversationFrame,/);
});

test('no prefetch call in the click: Next queues it for a later task, so it starts nothing at the tap', () => {
  // Measured 8 October 2026: with router.prefetch(href) in the click the route
  // request still started at 232 ms on a cold tap. Code must not claim a head
  // start it does not give.
  assert.doesNotMatch(moveFirst, /router\.prefetch\(/);
});

test('links stop prefetching only after the paint, and start again when the layer goes', () => {
  const flush = moveFirst.indexOf('flushSync(() => {');
  const reset = moveFirst.indexOf('setQuiet(false);', flush);
  const raf = moveFirst.indexOf('requestAnimationFrame(() => {', flush);
  const quietOn = moveFirst.indexOf('setQuiet(true);', raf);
  assert.ok(reset > flush && reset < raf, 'reset inside the flushSync commit');
  assert.ok(quietOn > raf, 'quiet only after the painted frame');
  assert.match(moveFirst, /const linksQuiet = quiet && visible;/);
  assert.match(moveFirst, /prefetch=\{quiet \? false : prefetch\}/);
});

test('the layer slides in opaque: its keyframe moves, it never fades', () => {
  const at = css.indexOf('@keyframes v2-move-first-enter');
  assert.ok(at > 0, 'keyframe missing');
  const body = css.slice(at, css.indexOf('html.v2-document-lock .v2-move-first', at));
  assert.match(body, /transform: translate3d\(1rem, 0, 0\)/);
  assert.doesNotMatch(body, /opacity/);
});

test('the layer covers the region below the bar, where the destination draws', () => {
  assert.match(moveFirst, /const barInset = parseFloat\(getComputedStyle\(region\)\.paddingTop\) \|\| 0;/);
  assert.match(moveFirst, /top: box\.top \+ barInset, left: box\.left, width: box\.width, height: box\.height - barInset/);
});

test('the destination header is published in the tap, before the frame', () => {
  const header = moveFirst.indexOf('if (header) setHeaderContext(header);');
  const flush = moveFirst.indexOf('flushSync(() => {');
  assert.ok(header > 0 && header < flush);
  assert.match(row, /header=\{\{ title: cleanTitle, confidential: Boolean\(is_confidential\) \}\}/);
});

test('a back move drops a pending layer, and a stale tap never pushes', () => {
  assert.match(moveFirst, /window\.addEventListener\('popstate', drop\);/);
  assert.match(moveFirst, /const drop = \(event: PopStateEvent\) => \{\s*tapRef\.current \+= 1;\s*const tap = tapRef\.current;\s*setPending\(null\);/);
  assert.match(moveFirst, /if \(tapRef\.current !== tap\) return;/);
});

test('the tap adds the history entry, so a back gesture in the wait returns to the list', () => {
  // Film, 9 October 2026: with the list as the first page opened, a back
  // 350 ms after the tap left the app. Next adds the entry only at commit.
  const flush = moveFirst.indexOf('flushSync(() => {');
  const entry = moveFirst.indexOf('pushPendingEntry(href);', flush);
  const raf = moveFirst.indexOf('requestAnimationFrame(() => {', flush);
  assert.ok(entry > flush && entry < raf, 'entry pushed in the click, after the frame commits');
  // Only Next's two fields: the list's scroll key must not reach the chat's entry.
  assert.match(moveFirst, /const entry = \{\s*__NA: true,\s*__PRIVATE_NEXTJS_INTERNALS_TREE: state\.__PRIVATE_NEXTJS_INTERNALS_TREE,\s*\[PENDING_MOVE_KEY\]: true,\s*\};/);
  assert.doesNotMatch(moveFirst, /\{ \.\.\.state, __NA: true/);
  assert.match(moveFirst, /if \(state\[PENDING_MOVE_KEY\]\) window\.history\.replaceState\(entry, '', href\);\s*else window\.history\.pushState\(entry, '', href\);/);
  assert.doesNotMatch(moveFirst.slice(moveFirst.indexOf('startNavigation(() => {')), /router\.push\(href\)/);
});

test('forward onto a dropped tap entry asks for the real route, after Next has restored', () => {
  // The listener runs before Next's; a navigation dispatched in it would be
  // discarded by Next's RESTORE. A task later the RESTORE has completed.
  assert.match(moveFirst, /\?\.\[PENDING_MOVE_KEY\]\) \{\s*window\.setTimeout\(\(\) => \{\s*if \(tapRef\.current !== tap\) return;[^\n]*\s*router\.replace\(window\.location\.pathname \+ window\.location\.search\);\s*\}, 0\);/);
  assert.doesNotMatch(moveFirst, /queueMicrotask/);
});

test('a back move while the layer is up clears the title the tap published', () => {
  assert.match(moveFirst, /useEffect\(\(\) => \{\s*if \(!visible\) return;\s*const clear = \(\) => clearHeaderContext\(\);\s*window\.addEventListener\('popstate', clear\);\s*return \(\) => window\.removeEventListener\('popstate', clear\);\s*\}, \[visible\]\);/);
});

test('a reload onto a tap entry does not keep the pending marker', () => {
  assert.match(moveFirst, /useEffect\(\(\) => \{\s*dropLeftoverMarker\(\);/);
  assert.match(moveFirst, /delete rest\[PENDING_MOVE_KEY\];\s*window\.history\.replaceState\(rest, '', window\.location\.href\);/);
});
