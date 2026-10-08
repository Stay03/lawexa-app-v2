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
  const push = moveFirst.indexOf('router.push(href);', start);
  assert.ok(flush > 0 && raf > flush && task > raf && start > task && push > start, 'order');
});

test('the layer shows while painting or while the navigation is pending, never after', () => {
  assert.match(moveFirst, /const visible = pending !== null && \(pending\.phase === 'painting' \|\| navigating\);/);
  assert.match(moveFirst, /\{ \.\.\.current, phase: 'navigating' \}/);
});

test('a plain click is taken over; the same page and no provider keep the default', () => {
  assert.match(moveFirst, /if \(!navigate \|\| pathOf\(href\) === pathname\) return;\s*event\.preventDefault\(\);\s*navigate\(href, kind, title\);/);
});

test('the real screen does not slide in again after the layer made the move', () => {
  assert.match(moveFirst, /skipRouteEntranceFor\(pathOf\(href\)\);/);
  assert.match(motion, /export function skipRouteEntranceFor\(pathname: string\): void/);
  assert.match(motion, /if \(entrancePlayedFor === pathname\) \{/);
  assert.match(css, /html\.v2-document-lock \.v2-move-first \{\s*animation: v2-route-enter-forward-a/);
});

test('chat rows move first with the conversation frame, under the v2 provider', () => {
  assert.match(row, /<MoveFirstLink\s+href=\{`\/c\/\$\{id\}`\}\s+kind="conversation"/);
  assert.match(layout, /<MoveFirstProvider>/);
  assert.match(moveFirst, /conversation: ConversationFrame,/);
});

test('the route request starts at the tap, before the frame is drawn', () => {
  const prefetch = moveFirst.indexOf('router.prefetch(href);');
  const flush = moveFirst.indexOf('flushSync(() => {');
  assert.ok(prefetch > 0 && prefetch < flush, 'prefetch before flushSync');
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
