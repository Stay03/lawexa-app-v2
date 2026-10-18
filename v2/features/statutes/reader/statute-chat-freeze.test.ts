import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* The statute page's text stops mounting while the phone chat covers it
 * (Arthur, 18 October 2026: on the ACJL the whole iPhone screen froze and the
 * app had to be force-closed). The chat makes the page under it inert, and
 * WebKit slows down with every batch inserted into an inert subtree; with the
 * mount paused nothing is inserted until the chat closes. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8').replace(/\r\n/g, '\n');

test('the batch loop waits while the page is under the phone chat, and resumes after', () => {
  const document = read('StatuteDocument.tsx');
  assert.match(document, /pauseMount = false,/);
  assert.match(
    document,
    /useEffect\(\(\) => \{\s*if \(pauseMount \|\| blocks\.length === 0 \|\| mountedCount >= blocks\.length\) return;/,
  );
  // Re-armed when the pause lifts: the flag is in the loop's dependencies.
  assert.match(document, /\}, \[pauseMount, mountedCount, blocks\.length\]\);/);
});

test('the statute page pauses exactly while its column is inert under the chat', () => {
  const screen = read('StatuteScreen.tsx');
  assert.match(screen, /inert=\{pageUnderChat\}/);
  assert.match(screen, /pauseMount=\{pageUnderChat\}/);
});
