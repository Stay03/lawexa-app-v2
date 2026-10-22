import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DRAWER_CLOSE_CAP_MS,
  afterPaint,
  drawerCloseStep,
  pathOf,
  type ArmedDrawerClose,
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
const ARMED: ArmedDrawerClose = { from: '/cases' };

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

test('the cap closes an armed drawer and ignores an unarmed one', () => {
  assert.equal(DRAWER_CLOSE_CAP_MS, 600);
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

test('every drawer row arms through closeFor with where it goes; only the X closes outright', () => {
  // Nothing is set in state in the click: the armed close and the cap are refs.
  assert.match(drawer, /const armedRef = useRef<ArmedDrawerClose \| null>\(null\);\s*const capRef = useRef\(0\);/);
  assert.match(drawer, /const closeFor = \(href: string\) => \{\s*if \(drawerCloseStep\(armedRef\.current, \{ kind: 'tap', href, pathname: shown \}\) === 'close'\) \{\s*close\(\);\s*return;\s*\}\s*disarm\(\);\s*armedRef\.current = \{ from: shown \};\s*capRef\.current = window\.setTimeout\(\(\) => \{\s*if \(drawerCloseStep\(armedRef\.current, \{ kind: 'cap' \}\) === 'close'\) close\(\);\s*\}, DRAWER_CLOSE_CAP_MS\);\s*\};/);
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
  assert.match(drawer, /const leave = useEffectEvent\(close\);\s*useEffect\(\(\) => \{\s*if \(drawerCloseStep\(armedRef\.current, \{ kind: 'shown', pathname: shown \}\) !== 'close-after-paint'\) return;\s*return afterPaint\(\(\) => leave\(\)\);\s*\}, \[shown\]\);/);
  // A scrim tap or Esc drops the armed close with the drawer.
  assert.match(drawer, /onOpenChange=\{\(open\) => \(open \? setOpenMobile\(true\) : close\(\)\)\}/);
  assert.match(drawer, /const close = \(\) => \{\s*disarm\(\);\s*setOpenMobile\(false\);\s*\};/);
  // The cap's timer goes with the drawer.
  assert.match(drawer, /const dropCap = useEffectEvent\(disarm\);\s*useEffect\(\(\) => \(\) => dropCap\(\), \[\]\);/);
  // Focus still returns without scrolling the locked document.
  assert.match(drawer, /target\?\.focus\(\{ preventScroll: true \}\);/);
});
