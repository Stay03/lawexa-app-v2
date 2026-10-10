import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for the document lock (Arthur's iPhone, 10 October 2026: in the side
// menu a tap opened the row ABOVE the one touched, and the message menu fired
// React for Copy). iOS hit-tested the fixed sheets against a document offset
// it did not paint. WebKit in Playwright hit-tests correctly either way, so
// these tests pin the mechanism; the phone test is Arthur's.
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const readRoot = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const css = read('shell.css');
const lock = read('document-lock.tsx');
const keyboard = read('use-keyboard-inset.ts');
const drawer = read('V2Drawer.tsx');

test('the locked body is fixed, with !important so the sheet scroll lock cannot make it relative', () => {
  assert.match(css, /html\.v2-document-lock,\s*html\.v2-document-lock body \{\s*overflow: hidden;\s*overscroll-behavior: none;\s*\}/);
  assert.match(css, /html\.v2-document-lock body \{\s*position: fixed !important;\s*inset: 0;\s*width: 100%;\s*\}/);
  assert.match(css, /body\[data-scroll-locked\] \{ position:\s*relative !important \}/);
});

test('the shell rows themselves stay out of position fixed (the keyboard rule stands)', () => {
  for (const selector of ['.v2-shell {', '.v2-shell__content {', '.v2-shell__dock {']) {
    const start = css.indexOf(selector);
    assert.ok(start >= 0, selector);
    const block = css.slice(start, css.indexOf('}', start));
    assert.doesNotMatch(block, /position:\s*fixed/, selector);
  }
});

test('the lock sets manual scroll restoration, resets the document, and watches return and sheet opening', () => {
  const order = [
    "html.classList.add('v2-document-lock')",
    'const previousRestoration = window.history.scrollRestoration;',
    "window.history.scrollRestoration = 'manual';",
    'restoreDocumentScroll();',
    "window.addEventListener('pageshow', onPageShow);",
    "document.addEventListener('visibilitychange', onVisibility);",
    'new MutationObserver(',
    'sheetOpened.observe(document.body, {',
  ];
  let at = -1;
  for (const piece of order) {
    const next = lock.indexOf(piece, at + 1);
    assert.ok(next > at, `${piece} in order`);
    at = next;
  }
  assert.match(lock, /attributeFilter: \['data-scroll-locked'\],\s*attributeOldValue: true,/);
  assert.match(lock, /if \(document\.visibilityState === 'visible'\) restoreDocumentScroll\(\);/);
  // Cleanup undoes all of it, scroll restoration included (v1 relies on it).
  const cleanup = lock.slice(lock.indexOf('return () => {'));
  for (const piece of [
    "html.classList.remove('v2-document-lock');",
    "window.removeEventListener('pageshow', onPageShow);",
    "document.removeEventListener('visibilitychange', onVisibility);",
    'sheetOpened.disconnect();',
    'window.history.scrollRestoration = previousRestoration;',
  ]) {
    assert.ok(cleanup.includes(piece), piece);
  }
});

test('one shared reset clears all three document offsets', async () => {
  const calls: string[] = [];
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { document: g.document, window: g.window };
  const scroller = { scrollTop: 44 };
  const body = { scrollTop: 46 };
  g.document = { scrollingElement: scroller, body };
  g.window = { scrollY: 47, scrollTo: (x: number, y: number) => calls.push(`scrollTo ${x},${y}`) };
  try {
    const { restoreDocumentScroll } = await import('./document-scroll');
    restoreDocumentScroll();
    assert.equal(scroller.scrollTop, 0);
    assert.equal(body.scrollTop, 0);
    assert.deepEqual(calls, ['scrollTo 0,0']);
    // At zero it writes nothing.
    (g.window as { scrollY: number }).scrollY = 0;
    restoreDocumentScroll();
    assert.deepEqual(calls, ['scrollTo 0,0']);
  } finally {
    g.document = saved.document;
    g.window = saved.window;
  }
  assert.match(keyboard, /import \{ restoreDocumentScroll \} from '\.\/document-scroll';/);
  assert.doesNotMatch(keyboard, /const restoreDocumentScroll =/);
  assert.match(keyboard, /if \(occlusion === 0 && settled\(\)\) restoreDocumentScroll\(\);/);
  assert.match(keyboard, /if \(occlusion === 0\) restoreDocumentScroll\(\);/);
});

test('the drawer returns focus without scrolling the document', () => {
  assert.match(drawer, /target\?\.focus\(\{ preventScroll: true \}\);/);
  assert.doesNotMatch(drawer, /target\?\.focus\(\);/);
});

test('the library behaviour the fix relies on is still there', () => {
  // A bump that changes any of these must fail here, not on a phone.
  const bar = readRoot('node_modules', 'react-remove-scroll-bar', 'dist', 'es2015', 'component.js');
  assert.match(bar, /lockAttribute = 'data-scroll-locked'/);
  assert.match(bar, /position: relative/);
  assert.match(bar, /important/);
  const focusScope = readRoot('node_modules', '@radix-ui', 'react-focus-scope', 'dist', 'index.mjs');
  assert.match(focusScope, /focus\(\{ preventScroll: true \}\)/);
  const appRouter = readRoot('node_modules', 'next', 'dist', 'client', 'components', 'app-router.js');
  assert.doesNotMatch(appRouter, /scrollRestoration/);
  const layout = readRoot('app', 'v2', 'layout.tsx');
  assert.match(layout, /<DocumentLock \/>/);
});
