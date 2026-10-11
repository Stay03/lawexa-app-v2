import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The case chat on a phone (Arthur, approved by Stay, 11 October 2026): ONE tap on
 * "Ask about this case" opens the chat full screen with the keyboard up, the composer
 * sits on the keyboard, and closing returns to the same place in the judgment.
 *
 * WebKit opens the keyboard only for a focus inside the reader's gesture, so the box
 * the reader taps must BE the open chat's composer: the dock grows around it instead of
 * a sheet mounting a second box (which needed its own tap). These are .tsx, so the
 * wiring is pinned by source; the keyboard, geometry and scroll position are checked
 * in a browser. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const detail = (file: string) => strip(read('v2', 'features', 'cases', 'detail', file));
const ask = detail('CaseAsk.tsx');
const screen = detail('CaseScreen.tsx');
const panel = detail('CaseChatPanel.tsx');
const core = detail('CaseChatCore.tsx');
const composer = strip(read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'));
const keyboard = strip(read('v2', 'shell', 'use-keyboard-inset.ts'));

test('no box is read-only or focused by code: the tap itself focuses the composer', () => {
  const hits = execFileSync('git', ['grep', '-l', '-e', 'engageWithoutKeyboard', '--', 'v2', 'app'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((f) => f && !f.endsWith('.test.ts'));
  assert.deepEqual(hits, []);
  assert.doesNotMatch(composer, /readOnly=/);
  assert.doesNotMatch(composer, /autoFocus/);
  for (const source of [ask, panel, core]) assert.doesNotMatch(source, /autoFocus/);
  assert.match(composer, /onFocus=\{onEngage\}/);
});

test('the phone sheet is gone; the dock owns the chat on a phone, with one composer', () => {
  assert.doesNotMatch(panel, /CaseChatSheet/);
  assert.doesNotMatch(screen, /CaseChatSheet|showSheet/);
  assert.match(screen, /const phone = isDesktopPanel === false;/);
  assert.match(screen, /const dockOwnsChat = phone \|\| floatingContext;/);
  assert.match(screen, /const showDock = dockOwnsChat \|\| renderedChat === null;/);
  assert.match(screen, /screen=\{phone\}/);
  assert.equal(ask.match(/<CaseChatComposerDock/g)?.length, 1, 'one composer in the dock');
  assert.equal(panel.match(/<CaseChatComposerDock/g)?.length, 1, 'one composer in the docked column');
});

test('the open phone card is the visible viewport, with no slide', () => {
  assert.match(ask, /top: 'var\(--visual-top, 0px\)'/);
  assert.match(ask, /height: 'var\(--visual-height, 100dvh\)'/);
  assert.doesNotMatch(ask, /--keyboard-inset/);
  assert.doesNotMatch(ask, /slide-in-from-bottom|slide-out-to-bottom/);
  assert.match(ask, /arrive && !screenMounted/);
});

test('the page keeps its length while the card is out of the flow', () => {
  assert.match(ask, /setProperty\('--v2-case-dock-h'/);
  assert.match(ask, /minHeight: 'var\(--v2-case-dock-h, auto\)'/);
  assert.match(ask, /new ResizeObserver/);
});

test('closing puts the keyboard away and never moves the judgment', () => {
  assert.match(ask, /active\.blur\(\);\s*card\.focus\(\{ preventScroll: true \}\);/);
  // The rendered markup (from the wrapper down) focuses nothing: only the close
  // effect above it moves focus.
  const markup = ask.slice(ask.indexOf('ref={wrapperRef}'));
  assert.doesNotMatch(markup, /\.focus\(/, 'nothing focuses on open');
});

test('the phone chat is a modal dialog that Escape closes and a status line announces', () => {
  assert.match(ask, /role=\{screenMounted \? 'dialog'/);
  assert.match(ask, /aria-modal=\{screenMounted \? true : undefined\}/);
  assert.match(ask, /event\.key === 'Escape'/);
  assert.match(ask, /role="status"/);
  assert.match(ask, /setAttribute\('inert', ''\)/);
  assert.match(screen, /inert=\{pageUnderChat\}/);
});

test('the keyboard hook publishes the visible height and offset beside the inset, and clears them', () => {
  const heights = keyboard.match(/setProperty\('--visual-height', `\$\{viewport\.height\}px`\)/g) ?? [];
  const tops = keyboard.match(/setProperty\('--visual-top', `\$\{viewport\.offsetTop\}px`\)/g) ?? [];
  assert.equal(heights.length, 2, 'height set on every update and on the blur path');
  assert.equal(tops.length, 2, 'offset set on every update and on the blur path');
  assert.match(keyboard, /removeProperty\('--visual-height'\)/);
  assert.match(keyboard, /removeProperty\('--visual-top'\)/);
});

test('the keyboard inset itself is unchanged for every other screen', () => {
  const insets = keyboard.match(/setProperty\('--keyboard-inset', `\$\{occlusion\}px`\)/g) ?? [];
  assert.equal(insets.length, 2);
  assert.match(keyboard, /window\.innerHeight - viewport\.height - viewport\.offsetTop/);
});
