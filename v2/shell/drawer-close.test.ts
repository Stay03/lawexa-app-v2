import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DRAWER_CLOSE_CAP_MS,
  afterContentDraws,
  EMPTY_CONTENT,
  afterPaint,
  contentChanged,
  drawerCloseStep,
  pathOf,
  type ArmedDrawerClose,
  type ContentSnapshot,
} from './drawer-close';

/* Stay, 22 October 2026: "when I select an option from the sidebar and it's
 * taking me to the page the sidebar closes weird". A row closed the drawer in
 * the click that started the route change, so the exit stalled under the new
 * screen's commit and cut. The drawer now closes once the page it opens is
 * up, and the decision is a pure function, tested here. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const drawer = read('V2Drawer.tsx');
const footer = read('V2UserFooter.tsx');

const NONE: ArmedDrawerClose | null = null;
const ARMED: ArmedDrawerClose = { from: '/cases', before: EMPTY_CONTENT, seen: false };
const ARMED_SEEN: ArmedDrawerClose = { from: '/cases', before: EMPTY_CONTENT, seen: true };

test('a row for the shown page closes the drawer at once', () => {
  assert.equal(drawerCloseStep(NONE, { kind: 'tap', href: '/cases', pathname: '/cases' }), 'close');
  // An absolute href and a trailing query compare by path.
  assert.equal(drawerCloseStep(NONE, { kind: 'tap', href: 'https://lawexa.com/cases?x=1', pathname: '/cases' }), 'close');
  // Armed or not: a second tap on the shown page still closes now.
  assert.equal(drawerCloseStep(ARMED, { kind: 'tap', href: '/cases', pathname: '/cases' }), 'close');
});

test('a row for another page arms a close and keeps the drawer open', () => {
  assert.equal(drawerCloseStep(NONE, { kind: 'tap', href: '/c/42', pathname: '/cases' }), 'arm');
  // A parent of the shown page is another page: "Cases" from inside a case.
  assert.equal(drawerCloseStep(NONE, { kind: 'tap', href: '/cases', pathname: '/cases/adeyemi-v-state' }), 'arm');
  assert.equal(drawerCloseStep(NONE, { kind: 'tap', href: '/', pathname: '/cases' }), 'arm');
});

test('the armed close fires after a paint once the shown path has changed, and not before', () => {
  assert.equal(drawerCloseStep(ARMED, { kind: 'shown', pathname: '/c/42' }), 'close-after-paint');
  // The same path again (a query-only write, a re-render) is not the destination.
  assert.equal(drawerCloseStep(ARMED, { kind: 'shown', pathname: '/cases' }), 'wait');
  // A path change with nothing armed (the drawer is closed, or was closed by the scrim) does nothing.
  assert.equal(drawerCloseStep(NONE, { kind: 'shown', pathname: '/c/42' }), 'wait');
});

test('a destination opened earlier this session closes on the address change, with no reading of the page (Tester, live, 23 October 2026)', () => {
  // Notes, then Cases, then Notes again: Notes was shown, so the tap is seen.
  assert.equal(drawerCloseStep(ARMED_SEEN, { kind: 'shown', pathname: '/notes' }), 'close-now');
  // Not before the address changes, and a first visit keeps the wait.
  assert.equal(drawerCloseStep(ARMED_SEEN, { kind: 'shown', pathname: '/cases' }), 'wait');
  assert.equal(drawerCloseStep(ARMED, { kind: 'shown', pathname: '/notes' }), 'close-after-paint');
});

test('the drawer records every shown path and marks a tap to one of them as seen', () => {
  assert.match(drawer, /const openedRef = useRef<Set<string>>\(new Set\(\)\);\s*useEffect\(\(\) => \{\s*openedRef\.current\.add\(shown\);\s*\}, \[shown\]\);/);
  assert.match(drawer, /seen: openedRef\.current\.has\(pathOf\(href\)\),/);
  assert.match(drawer, /if \(step === 'close-now'\) \{\s*leave\(\);\s*return;\s*\}/);
});

test('the cap closes an armed drawer and ignores an unarmed one', () => {
  // Live, Notes' loading rows drew at about 0.39 s on a first visit: 450 ms covers that and bounds a slow one.
  assert.equal(DRAWER_CLOSE_CAP_MS, 450);
  assert.equal(drawerCloseStep(ARMED, { kind: 'cap' }), 'close');
  assert.equal(drawerCloseStep(NONE, { kind: 'cap' }), 'wait');
});

test('pathOf reads a path the way useShownPathname reports one', () => {
  assert.equal(pathOf('/c/42'), '/c/42');
  assert.equal(pathOf('/c/42?from=drawer#top'), '/c/42');
  assert.equal(pathOf('https://lawexa.com/settings/profile'), '/settings/profile');
});

test('afterPaint runs after an animation frame and then a task, and its cancel stops either', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = g.window;
  const frames: Array<() => void> = [];
  const tasks: Array<() => void> = [];
  const cancelled: string[] = [];
  g.window = {
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
    cancelAnimationFrame: (id: number) => cancelled.push(`frame ${id}`),
    setTimeout: (callback: () => void, ms: number) => {
      assert.equal(ms, 0);
      return tasks.push(callback);
    },
    clearTimeout: (id: number) => cancelled.push(`task ${id}`),
  };
  try {
    let ran = 0;
    const cancel = afterPaint(() => {
      ran += 1;
    });
    assert.equal(frames.length, 1);
    assert.equal(tasks.length, 0, 'nothing runs in the frame itself');
    frames[0]();
    assert.equal(ran, 0, 'nothing runs before the task');
    assert.equal(tasks.length, 1);
    tasks[0]();
    assert.equal(ran, 1);
    cancel();
    assert.deepEqual(cancelled, ['frame 1', 'task 1']);

    // Cancelled before the frame: the task is never queued.
    const early = afterPaint(() => {
      ran += 1;
    });
    early();
    assert.deepEqual(cancelled.slice(2), ['frame 2', 'task 0']);
    assert.equal(tasks.length, 1);
  } finally {
    g.window = saved;
  }
});

/* Tester's live checks: on a first visit to Notes the address committed at
 * about 0.12 s with the top bar alone on screen, and the drawer slid away over
 * that until the loading rows came at about 0.39 s (22 October 2026). The
 * first fix counted any text in the content area as drawn, and the old page,
 * still mounted under the route change, passed at once (23 October 2026). The
 * new page is up once the area shows something the tap did not see. */
const snap = (text: string, skeletons = 0): ContentSnapshot => ({ text, skeletons });
const HOME = snap('Good evening Ask Lawexa anything');

test('the new page is up once the content area shows something the tap did not see', () => {
  // The old page still mounted under the route change: not the new one.
  assert.equal(contentChanged(HOME, HOME), false);
  // Nothing on screen yet (the v2 root's empty boundary; its sr-only line is not read).
  assert.equal(contentChanged(HOME, EMPTY_CONTENT), false);
  // The new page's loading rows, or its words.
  assert.equal(contentChanged(HOME, snap('', 6)), true, 'a loading skeleton is the first picture');
  assert.equal(contentChanged(HOME, snap('Notes Community Mine')), true);
  // Rows the old page already had do not count; more of them do.
  assert.equal(contentChanged(snap('', 3), snap('', 3)), false);
  assert.equal(contentChanged(snap('', 3), snap('', 4)), true);
});

test('afterContentDraws checks each frame, then waits one painted frame, and its cancel stops it', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = g.window;
  const frames: Array<() => void> = [];
  const tasks: Array<() => void> = [];
  g.window = {
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
    cancelAnimationFrame: () => undefined,
    setTimeout: (callback: () => void) => tasks.push(callback),
    clearTimeout: () => undefined,
  };
  try {
    let shown: ContentSnapshot = HOME;
    let ran = 0;
    afterContentDraws(() => shown, HOME, () => {
      ran += 1;
    });
    frames.shift()?.();
    frames.shift()?.();
    assert.equal(ran, 0, 'still the old page after two frames: nothing runs');
    assert.equal(frames.length, 1, 'and it keeps watching');
    shown = EMPTY_CONTENT;
    frames.shift()?.();
    assert.equal(ran, 0, 'an empty screen is not the page either');
    shown = snap('', 6);
    frames.shift()?.(); // the frame that finds the page
    assert.equal(ran, 0, 'not in the frame that finds it');
    frames.shift()?.(); // afterPaint's frame
    tasks.shift()?.(); // afterPaint's task
    assert.equal(ran, 1);

    // Cancelled while still empty: it stops watching and never runs.
    let never = 0;
    const cancel = afterContentDraws(() => HOME, HOME, () => {
      never += 1;
    });
    cancel();
    frames.splice(0).forEach((frame) => frame());
    assert.equal(never, 0);
  } finally {
    g.window = saved;
  }
});

test('a page already drawn when the watch starts goes on a microtask, with no frame (Tester, live, 23 October 2026)', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = g.window;
  const frames: Array<() => void> = [];
  g.window = {
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
    cancelAnimationFrame: () => undefined,
    setTimeout: () => 0,
    clearTimeout: () => undefined,
  };
  try {
    // Notes, then Cases, then Notes again: the cached list is on screen when the address changes.
    let ran = 0;
    afterContentDraws(() => snap('Notes Community Mine'), HOME, () => {
      ran += 1;
    });
    assert.equal(frames.length, 0, 'no frame is waited for');
    assert.equal(ran, 0, 'not inside the effect itself');
    await Promise.resolve();
    assert.equal(ran, 1, 'on the microtask, in the same frame');

    // Cancelled before the microtask: it never runs.
    let never = 0;
    const cancel = afterContentDraws(() => snap('', 6), HOME, () => {
      never += 1;
    });
    cancel();
    await Promise.resolve();
    assert.equal(never, 0);
  } finally {
    g.window = saved;
  }
});

test('every drawer row arms through closeFor with where it goes; only the X closes outright', () => {
  // Nothing is set in state in the click: the armed close and the cap are refs.
  assert.match(drawer, /const armedRef = useRef<ArmedDrawerClose \| null>\(null\);\s*const capRef = useRef\(0\);/);
  assert.match(drawer, /const closeFor = \(href: string\) => \{\s*if \(drawerCloseStep\(armedRef\.current, \{ kind: 'tap', href, pathname: shown \}\) === 'close'\) \{\s*close\(\);\s*return;\s*\}\s*disarm\(\);\s*\/\/ [^\n]*\n\s*\/\/ [^\n]*\n\s*armedRef\.current = \{\s*from: shown,\s*before: readContent\(document\.getElementById\(V2_SHELL_CONTENT_ID\)\),\s*seen: openedRef\.current\.has\(pathOf\(href\)\),\s*\};\s*capRef\.current = window\.setTimeout\(\(\) => \{\s*if \(drawerCloseStep\(armedRef\.current, \{ kind: 'cap' \}\) === 'close'\) close\(\);\s*\}, DRAWER_CLOSE_CAP_MS\);\s*\};/);
  assert.equal((drawer.match(/onClick=\{\(\) => closeFor\(v2NewChat\.href\)\}/g) ?? []).length, 2, 'the wordmark and the New chat row');
  assert.match(drawer, /onClick=\{\(\) => closeFor\(item\.href\)\}/);
  assert.match(drawer, /onClick=\{\(\) => onNavigate\(sub\.href\)\}/);
  assert.match(drawer, /onNavigate=\{closeFor\}\s*\/>/);
  assert.match(drawer, /<V2UserFooter user=\{user\} onNavigate=\{closeFor\} \/>/);
  // The one close with no destination: the X button.
  assert.equal((drawer.match(/onClick=\{close\}/g) ?? []).length, 1);
  // The footer hands each row's destination on.
  for (const href of ['/register', '/login', '/settings/profile']) {
    assert.match(footer, new RegExp(`href="${href}"\\s+onClick=\\{\\(\\) => onNavigate\\?\\.\\('${href}'\\)\\}`), href);
  }
  assert.match(footer, /onNavigate\?: \(href: string\) => void;/);
});

test('the drawer closes on the shown path, after a painted frame, with no setState in the effect body', () => {
  // The shown path, not the router's: a chat row's frame changes it in the tap's own commit.
  assert.match(drawer, /const shown = useShownPathname\(\);/);
  assert.match(drawer, /const leave = useEffectEvent\(close\);\s*useEffect\(\(\) => \{\s*const armed = armedRef\.current;\s*if \(armed === null\) return;\s*const step = drawerCloseStep\(armed, \{ kind: 'shown', pathname: shown \}\);\s*if \(step === 'close-now'\) \{\s*leave\(\);\s*return;\s*\}\s*if \(step !== 'close-after-paint'\) return;\s*const region = document\.getElementById\(V2_SHELL_CONTENT_ID\);\s*return afterContentDraws\(\(\) => readContent\(region\), armed\.before, \(\) => leave\(\)\);\s*\}, \[shown\]\);/);
  // What the tap saw is read without a screen-reader line or a hidden subtree.
  const close = read('drawer-close.ts');
  assert.match(close, /const UNSEEN = '\.sr-only, \[hidden\], \[aria-hidden="true"\]';/);
  assert.match(close, /if \(!parent \|\| parent\.closest\(UNSEEN\)\) continue;/);
  // A scrim tap or Esc drops the armed close with the drawer.
  assert.match(drawer, /onOpenChange=\{\(open\) => \(open \? setOpenMobile\(true\) : close\(\)\)\}/);
  assert.match(drawer, /const close = \(\) => \{\s*disarm\(\);\s*setOpenMobile\(false\);\s*\};/);
  // The cap's timer goes with the drawer.
  assert.match(drawer, /const dropCap = useEffectEvent\(disarm\);\s*useEffect\(\(\) => \(\) => dropCap\(\), \[\]\);/);
  // Focus still returns without scrolling the locked document.
  assert.match(drawer, /target\?\.focus\(\{ preventScroll: true \}\);/);
});
