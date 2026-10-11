import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The case chat sheet with the keyboard open (Arthur, 11 October 2026): in Safari and
 * the home-screen app the sheet's header and close button went above the screen,
 * because a fixed 65dvh sheet (with a 20rem floor) lifted by the keyboard is taller
 * than the space the keyboard leaves. The sheet and the keyboard hook are .tsx and
 * React, so these pin the wiring by source. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const panel = strip(read('v2', 'features', 'cases', 'detail', 'CaseChatPanel.tsx'));
const keyboard = strip(read('v2', 'shell', 'use-keyboard-inset.ts'));
const sheet = panel.slice(panel.indexOf('export function CaseChatSheet'), panel.indexOf('export function CaseChatDocked'));

test('the sheet is never taller than the visible viewport, less the status bar', () => {
  assert.match(
    panel,
    /CASE_CHAT_SHEET_HEIGHT =\s*'min\(65dvh, calc\(var\(--visual-height, 100dvh\) - env\(safe-area-inset-top, 0px\) - 0\.75rem\)\)'/,
  );
  assert.match(sheet, /style=\{\{ bottom: 'var\(--keyboard-inset, 0px\)', height: CASE_CHAT_SHEET_HEIGHT \}\}/);
});

test('the sheet has no fixed height or floor that could outgrow the space', () => {
  assert.doesNotMatch(sheet, /h-\[65dvh\]/);
  assert.doesNotMatch(sheet, /min-h-80/);
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
