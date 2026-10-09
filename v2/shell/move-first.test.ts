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
  assert.match(moveFirst, /conversation: ConversationMoveFrame,/);
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
  const tapBody = moveFirst.slice(moveFirst.indexOf('const navigate: Navigate = '));
  const header = tapBody.indexOf('if (header) setHeaderContext(header);');
  const raise = tapBody.indexOf('raise(href, kind, title, region);');
  assert.ok(header > 0 && raise > header);
  assert.match(row, /header=\{\{ title: cleanTitle, confidential: Boolean\(is_confidential\) \}\}/);
});

test('a back move drops a pending layer, and a stale tap never pushes', () => {
  assert.match(moveFirst, /const listener = \(event: PopStateEvent\) => onPopState\(event\);\s*window\.addEventListener\('popstate', listener\);/);
  assert.match(moveFirst, /const onPopState = useEffectEvent\(\(event: PopStateEvent\) => \{\s*tapRef\.current \+= 1;\s*const tap = tapRef\.current;/);
  assert.match(moveFirst, /if \(!state\?\.\[PENDING_MOVE_KEY\] \|\| !region\) \{[^}]*if \(visible\) clearHeaderContext\(\);\s*setPending\(null\);\s*return;\s*\}/);
  assert.match(moveFirst, /if \(tapRef\.current !== tap\) return;/);
});

test('the tap adds the history entry, so a back gesture in the wait returns to the list', () => {
  // Film, 9 October 2026: with the list as the first page opened, a back
  // 350 ms after the tap left the app. Next adds the entry only at commit.
  const tapBody = moveFirst.slice(moveFirst.indexOf('const navigate: Navigate = '));
  const raise = tapBody.indexOf('raise(href, kind, title, region);');
  const entry = tapBody.indexOf('pushPendingEntry(href, kind);');
  const later = tapBody.indexOf('navigateAfterPaint(href, tap);');
  assert.ok(raise > 0 && entry > raise && later > entry, 'entry pushed in the click, after the frame commits');
  // Only Next's two fields: the list's scroll key must not reach the chat's entry.
  assert.match(moveFirst, /const entry = \{\s*__NA: true,\s*__PRIVATE_NEXTJS_INTERNALS_TREE: state\.__PRIVATE_NEXTJS_INTERNALS_TREE,\s*\[PENDING_MOVE_KEY\]: true,\s*\[PENDING_KIND_KEY\]: kind,\s*\};/);
  assert.doesNotMatch(moveFirst, /\{ \.\.\.state, __NA: true/);
  assert.match(moveFirst, /if \(state\[PENDING_MOVE_KEY\]\) window\.history\.replaceState\(entry, '', href\);\s*else window\.history\.pushState\(entry, '', href\);/);
  const afterPaint = moveFirst.slice(moveFirst.indexOf('const navigateAfterPaint = '), moveFirst.indexOf('const onPopState = '));
  assert.match(afterPaint, /router\.replace\(href\);/);
  assert.doesNotMatch(afterPaint, /router\.push\(href\)/);
});

test('forward onto a dropped tap entry raises the frame first, then asks for the real route', () => {
  // Film, 9 October 2026: the forward painted a blank region under the chat's
  // bar before the skeleton. The frame is raised in the popstate listener,
  // which runs before Next's, and the route is asked for after a painted frame
  // and a task, when Next's RESTORE has completed (a navigation dispatched in
  // the listener would be discarded by it).
  const handler = moveFirst.slice(moveFirst.indexOf('const onPopState = useEffectEvent('));
  const raise = handler.indexOf('raise(href, ');
  const later = handler.indexOf('navigateAfterPaint(href, tap);');
  assert.ok(raise > 0 && later > raise);
  assert.match(handler, /const href = window\.location\.pathname \+ window\.location\.search;/);
  assert.doesNotMatch(moveFirst, /queueMicrotask/);
});

test('the title a dropped tap left behind is cleared when a top-level screen becomes current', () => {
  // A back after the route's loading screen replaced the layer, with the chat
  // never mounted, kept the tap's title in the store (film log, 9 October 2026).
  assert.match(moveFirst, /useEffect\(\(\) => \{\s*if \(isTopLevelRoute\(pathname\)\) clearHeaderContext\(\);\s*\}, \[pathname\]\);/);
  assert.doesNotMatch(moveFirst, /window\.addEventListener\('popstate', clear\)/);
});

test('a reload onto a tap entry does not keep the pending marker', () => {
  assert.match(moveFirst, /useEffect\(\(\) => \{\s*dropLeftoverMarker\(\);/);
  assert.match(moveFirst, /delete rest\[PENDING_MOVE_KEY\];\s*delete rest\[PENDING_KIND_KEY\];\s*window\.history\.replaceState\(rest, '', window\.location\.href\);/);
});

test('a screen the browser already slid in (its own back swipe) does not slide in again', () => {
  // Chrome on Android animates a left-edge back swipe itself; our back entrance
  // after it moved the list twice (Fable review, 9 October 2026).
  assert.match(motion, /browserAnimated = event\.hasUAVisualTransition === true;/);
  const reset = motion.indexOf("if (event.navigationType === 'replace') return;");
  const read = motion.indexOf('browserAnimated = event.hasUAVisualTransition === true;');
  const traverse = motion.indexOf("if (event.navigationType === 'traverse') {");
  assert.ok(reset > 0 && read > reset && traverse > read, 'set for every non-replace navigation, before the traverse branch');
  const effect = motion.indexOf('if (browserAnimated) {');
  const play = motion.indexOf('region.setAttribute(ENTER_ATTR');
  assert.ok(effect > 0 && play > effect, 'checked before the entrance is written');
  assert.match(motion, /if \(browserAnimated\) \{[^}]*browserAnimated = false;[^}]*return;/);
});

test('the back entrance slides in opaque: its keyframes move, they never fade', () => {
  // Film, 9 October 2026: the frame at 1,363 ms was empty dark with the list
  // already in the DOM (1,321 ms); back-a and back-b started at opacity 0.
  const at = css.indexOf('@keyframes v2-route-enter-back-a');
  assert.ok(at > 0, 'back keyframes missing');
  const body = css.slice(at, css.indexOf('html.v2-document-lock .v2-shell__content[data-v2-route-enter]', at));
  assert.ok(body.includes('@keyframes v2-route-enter-back-b'), 'both parities in the slice');
  assert.equal((body.match(/transform: translate3d\(-1rem, 0, 0\)/g) ?? []).length, 2);
  assert.doesNotMatch(body, /opacity/);
});

test('the conversation frame counts as a skeleton on screen, so the screen draws its own in the same commit', () => {
  // Film, 9 October 2026: after the layer went, the region under the chat's
  // bar was page colour for 150-200 ms while the screen held its skeleton
  // (skeleton-hold.ts). The screen reads the mark in its first render, while
  // the layer is still mounted; the layer leaves in the commit that mounts it.
  assert.match(moveFirst, /import \{ RouteSkeletonMark \} from '@\/v2\/features\/conversations\/conversation\/route-skeleton-mark';/);
  assert.match(moveFirst, /function ConversationMoveFrame\(\) \{\s*return \(\s*<>\s*<RouteSkeletonMark \/>\s*<ConversationFrame \/>\s*<\/>\s*\);\s*\}/);
  assert.match(moveFirst, /conversation: ConversationMoveFrame,/);
  // Kind-specific: only the conversation screen reads the counter.
  const pageFrame = moveFirst.slice(moveFirst.indexOf('function PageFrame()'), moveFirst.indexOf('function ConversationMoveFrame()'));
  assert.doesNotMatch(pageFrame, /RouteSkeletonMark/);
  assert.doesNotMatch(moveFirst.slice(moveFirst.indexOf('function PendingScreen(')), /RouteSkeletonMark/);
});

test('a closed sheet holds its exit end state, so the drawer does not snap back open', () => {
  // Fable trace and film, 9 October 2026: the sheet's exit ended at fill-mode
  // none, and the drawer showed fully open again until the chat's route
  // committed (up to about 1 s on a slow chat, live links included).
  assert.match(css, /html\.v2-document-lock \[data-slot='sheet-overlay'\]\[data-state='closed'\],\s*html\.v2-document-lock \[data-slot='sheet-content'\]\[data-state='closed'\] \{\s*animation-fill-mode: forwards;\s*\}/);
});
