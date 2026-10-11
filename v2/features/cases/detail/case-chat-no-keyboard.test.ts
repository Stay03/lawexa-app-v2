import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Opening the case chat on a phone raises no keyboard (Stay and Arthur, 11 October
 * 2026). The page's "Ask about this case" box opened the sheet on focus, so the tap
 * raised the keyboard while the sheet slid in, and the sheet then focused its own
 * box: the jump Stay saw on Samsung. Now the page box is read-only below xl (it
 * still focuses and engages, no keyboard), and the sheet focuses itself. These are
 * .tsx, so the wiring is pinned by source. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const composer = strip(read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'));
const screen = strip(read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx'));
const panel = strip(read('v2', 'features', 'cases', 'detail', 'CaseChatPanel.tsx'));

test('the shared composer keeps the keyboard by default; the opt-in makes the box read-only', () => {
  assert.match(composer, /engageWithoutKeyboard = false,/);
  assert.match(composer, /onFocus=\{onEngage\}\s*readOnly=\{engageWithoutKeyboard \|\| undefined\}/);
});

test('only the case page turns it on, and only below xl', () => {
  assert.match(screen, /engageWithoutKeyboard=\{isDesktopPanel === false\}/);
  const files = execFileSync('git', ['grep', '-l', 'engageWithoutKeyboard=', '--', 'v2', 'app'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => !f.endsWith('.test.ts'))
    .sort();
  // The case page sets it; CaseAsk and CaseChatCore only pass it through.
  assert.deepEqual(files, [
    'v2/features/cases/detail/CaseAsk.tsx',
    'v2/features/cases/detail/CaseChatCore.tsx',
    'v2/features/cases/detail/CaseScreen.tsx',
  ]);
});

test('the sheet focuses itself, not its box, so opening it raises no keyboard', () => {
  const sheet = panel.slice(panel.indexOf('export function CaseChatSheet'), panel.indexOf('export function CaseChatDocked'));
  assert.match(sheet, /sheetRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(sheet, /ref=\{sheetRef\}\s*tabIndex=\{-1\}/);
  assert.doesNotMatch(panel, /autoFocus=\{/);
});
