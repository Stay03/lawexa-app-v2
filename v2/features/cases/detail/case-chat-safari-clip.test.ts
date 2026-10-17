import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Safari, the phone case chat, the keyboard rising (Arthur's recording with
 * ?kbdebug=1, 17 October 2026): "kb inset 278 shell h 440", the card held at
 * 100dvh, html.scrollTop 278. iOS clips the fixed card to the shell's content
 * region, which the inset had shrunk, so the screen under it was black for a
 * frame or two. While the card covers the screen the shell keeps its full
 * height; the card places itself from the visible viewport. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('while the phone chat covers the screen the shell does not give up the keyboard\'s height', () => {
  const ask = read('v2', 'features', 'cases', 'detail', 'CaseAsk.tsx');
  assert.match(ask, /const CHAT_SCREEN_ATTR = 'data-v2-chat-screen';/);
  // Set with the bars' hiding, removed with their restore, so every way out clears it.
  assert.match(ask, /root\.style\.backgroundColor = 'var\(--popover\)';\s*root\.setAttribute\(CHAT_SCREEN_ATTR, ''\);/);
  assert.match(ask, /root\.style\.backgroundColor = backgroundColor;\s*root\.removeAttribute\(CHAT_SCREEN_ATTR\);/);

  const css = read('v2', 'shell', 'shell.css');
  assert.match(css, /html\[data-v2-chat-screen\] \.v2-shell \{\s*height: 100dvh;\s*\}/);
  // Everywhere else the shell still gives the keyboard its height.
  assert.match(css, /height: calc\(100dvh - var\(--keyboard-inset, 0px\)\);/);
});
