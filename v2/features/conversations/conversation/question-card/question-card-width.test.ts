import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Stay on live, 14 November 2026 (c91086ec 2b7e55bb): "the question component is
 * too narrow looks weirdly long". The card sat on the compact box at its width
 * (about 288px on a phone), so every option and hint wrapped. While a card is
 * open the dock takes the chat column's width; the box keeps its compact width
 * otherwise. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test("while a card is open the dock is the chat column's width; without one, the compact box's", () => {
  const dock = read('v2', 'features', 'conversations', 'conversation', 'ChatDock.tsx');
  assert.match(dock, /const DOCK_COMPACT = 'max-w-xs sm:max-w-md';/);
  assert.match(dock, /const DOCK_WITH_CARD = 'max-w-2xl';/);
  assert.match(dock, /className=\{cn\('pointer-events-auto v2-safe-bottom mx-auto w-full', openCard \? DOCK_WITH_CARD : DOCK_COMPACT\)\}/);
  // The chat column it lines up with.
  const list = read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx');
  assert.match(list, /'mx-auto flex max-w-2xl flex-col gap-6 px-4 /);
});

test('the option rows are compact: less padding, no gap between rows, the hint under its label', () => {
  const card = read('v2', 'features', 'conversations', 'conversation', 'question-card', 'QuestionDock.tsx');
  assert.match(card, /className="mt-1\.5 flex flex-col"/);
  assert.match(card, /'v2-interactive flex w-full items-start gap-2\.5 rounded-xl px-2 py-1\.5 text-left/);
  assert.match(card, /<span className="block text-\[12\.5px\] leading-snug text-muted-foreground">\{option\.description\}<\/span>/);
  assert.doesNotMatch(card, /py-2 text-left/);
});

test('the question step reads in words, not as the tool name', () => {
  const step = read('v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx');
  assert.match(step, /case 'ask_user':\s*return \{\s*action: isComplete \? 'Asked you a question' : 'Asking you a question',/);
});
