import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAT_QUICK_JUMP, CHAT_QUICK_JUMP_ITEM, CHAT_QUICK_JUMP_ROW } from './home-frame';

/* The Chat home's shortcuts stay on one line on every phone (Arthur, 18
 * October 2026: on some phones Quiz dropped under the other three; "smaller
 * pills", icon and word side by side). */

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8').replace(/\r\n/g, '\n');

test('the row never wraps: one line that slides sideways when it cannot fit', () => {
  assert.doesNotMatch(CHAT_QUICK_JUMP, /flex-wrap/);
  assert.match(CHAT_QUICK_JUMP, /\boverflow-x-auto\b/);
  assert.match(CHAT_QUICK_JUMP, /\bmd:hidden\b/);
  // Centred when it fits, starting at its first pill when it does not.
  assert.match(CHAT_QUICK_JUMP_ROW, /\bmx-auto\b/);
  assert.match(CHAT_QUICK_JUMP_ROW, /\bw-max\b/);
  assert.match(CHAT_QUICK_JUMP_ROW, /\bflex-nowrap\b/);
  // The strip hides its bar, as every horizontal strip does.
  assert.match(read('HomeQuickJump.tsx'), /<nav aria-label="Quick links" data-v2-strip="" className=\{CHAT_QUICK_JUMP\}>/);
});

test('smaller pills, icon and word side by side, still a thumb’s height', () => {
  assert.match(CHAT_QUICK_JUMP_ITEM, /\bmin-h-11\b/);
  assert.match(CHAT_QUICK_JUMP_ITEM, /\bshrink-0\b/);
  assert.match(CHAT_QUICK_JUMP_ITEM, /\bwhitespace-nowrap\b/);
  assert.match(CHAT_QUICK_JUMP_ITEM, /\bpx-2\b/);
  // In rem, so a phone's larger text setting scales the word with the page.
  assert.match(CHAT_QUICK_JUMP_ITEM, /\btext-\[0\.8125rem\]/);
  assert.match(read('HomeQuickJump.tsx'), /<Icon className="size-3\.5 shrink-0" aria-hidden \/>/);
});
