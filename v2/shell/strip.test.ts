import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A horizontal strip never shows a scrollbar (Stay, 15 October 2026, an
 * Android phone: "just look at that atrocious scroll bar in the tab"). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('every strip hides its scrollbar on every browser, and fades the edge with more', () => {
  const css = read('v2', 'shell', 'shell.css');
  assert.match(css, /\[data-v2-strip\] \{\s*scrollbar-width: none;\s*\}/);
  assert.match(css, /\[data-v2-strip\]::-webkit-scrollbar \{\s*display: none;\s*\}/);
  assert.match(css, /\[data-v2-strip\]\[data-overflow-end\] \{/);
  assert.match(css, /\[data-v2-strip\]\[data-overflow-start\] \{/);
});

test('TabRow stamps the strip and marks which edges have more', () => {
  const row = read('v2', 'shell', 'TabRow.tsx');
  assert.match(row, /role="tablist" aria-label=\{ariaLabel\} data-v2-strip=""/);
  assert.match(row, /list\.toggleAttribute\('data-overflow-start', start\);/);
  assert.match(row, /list\.toggleAttribute\('data-overflow-end', end\);/);
});

test('the chip and attachment strips that are not tab rows carry it too', () => {
  for (const parts of [
    ['v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'],
    ['v2', 'features', 'conversations', 'conversation', 'rows', 'SentAttachments.tsx'],
    ['v2', 'features', 'conversations', 'conversation', 'rows', 'UserMessageRow.tsx'],
    ['v2', 'features', 'folders', 'picker', 'PickerBody.tsx'],
  ]) {
    assert.match(read(...parts), /data-v2-strip=""/, parts.join('/'));
  }
});
