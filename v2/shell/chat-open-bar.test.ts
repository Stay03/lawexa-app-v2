import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasOpenBar, isChatRoute, isTopLevelRoute, topLevelScreenFor } from './top-level-route';
import { pushedScreenFor } from './pushed-route';

/* A conversation wears the list pages' open bar (Stay, 13 October 2026: "remove the
 * header from the top both here and regular single user chat too. it should look
 * like the list page"). Its title and space move into the transcript's masthead. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a conversation has the open bar, and is not a top-level screen', () => {
  for (const path of ['/c/abc', '/v2/c/abc', '/c/6d3c8110-3b34-403a-aed5-bd669a52cf56']) {
    assert.equal(isChatRoute(path), true, path);
    assert.equal(hasOpenBar(path), true, path);
    // Not top-level: it publishes its own title, which the move-first clear for
    // top-level screens (move-first.tsx) must not wipe.
    assert.equal(isTopLevelRoute(path), false, path);
    assert.equal(topLevelScreenFor(path), null, path);
    // And not a pushed screen: no back arrow, the hamburger stays.
    assert.equal(pushedScreenFor(path), null, path);
  }
  for (const path of ['/c', '/c/abc/extra', '/cases/abc', '/conversations']) {
    assert.equal(isChatRoute(path), false, path);
  }
  assert.equal(hasOpenBar('/conversations'), true);
  assert.equal(hasOpenBar('/cases/abc'), false);
});

test('the shell frame and the bar read the open-bar predicate', () => {
  const frame = read('v2', 'shell', 'ShellFrame.tsx');
  assert.match(frame, /hasOpenBar\(pathname\) && 'v2-shell--open'/);
  assert.match(frame, /isChatRoute\(pathname\) && 'v2-shell--chat'/);
  const header = read('v2', 'shell', 'V2Header.tsx');
  assert.match(header, /const isTopLevel = hasOpenBar\(path\);/);
  // The move-first clear still keys on top-level screens only.
  assert.match(read('v2', 'shell', 'move-first.tsx'), /if \(isTopLevelRoute\(pathname\)\) clearHeaderContext\(\);/);
});

test('on a phone the bar room moves into the chat: its frame below the buttons, the transcript scrolling under them', () => {
  const css = read('v2', 'shell', 'shell.css');
  const phone = css.slice(css.indexOf('@media (max-width: 47.999rem)'));
  assert.match(phone, /html\.v2-document-lock \.v2-shell--chat \.v2-shell__content \{\s*padding-top: 0;\s*\}/);
  assert.match(phone, /html\.v2-document-lock \.v2-shell--chat \[data-v2-chat-frame\] \{\s*padding-top: var\(--v2-bar-h\);\s*\}/);
  assert.match(phone, /\[data-v2-chat-list\]\[data-under-bar\] \{\s*margin-top: calc\(-1 \* var\(--v2-bar-h\)\);\s*\}/);
  assert.match(phone, /\[data-v2-chat-list\]\[data-under-bar\] > \[data-v2-chat-scroller\] \{\s*padding-top: var\(--v2-bar-h\);\s*\}/);
  const list = read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx');
  assert.match(list, /data-v2-chat-list=""\s*data-under-bar=\{underBar \? '' : undefined\}/);
  assert.match(list, /data-v2-chat-scroller=""/);
  // The scroller is a containing block, so nothing absolutely placed in the
  // transcript (the author line's sr-only text) can overflow into the shell
  // region and make the chat draggable as a whole (real-server pass 10).
  assert.match(list, /data-v2-chat-scroller=""[\s\S]{0,600}?className="v2-quiet-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain"/);
  const screen = read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  assert.match(screen, /data-v2-chat-frame=""/);
  // The skeleton the route shows first sits below the buttons too.
  assert.match(read('app', 'v2', 'c', '[conversationId]', 'loading.tsx'), /data-v2-chat-frame=""/);
});

test('the masthead carries the title and the space link, on its own route only', () => {
  const screen = read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  assert.match(screen, /masthead=\{embed \? null : <ConversationMasthead \/>\}/);
  // Below the confidential banner, the transcript does not pull up under the bar.
  assert.match(screen, /underBar=\{!embed && !controller\.isConfidential\}/);
  const masthead = read('v2', 'features', 'conversations', 'conversation', 'ConversationMasthead.tsx');
  assert.match(masthead, /const \{ title, confidential \} = useHeaderContext\(\);/);
  assert.match(masthead, /const place = useHeaderPlace\(\);/);
  assert.match(masthead, /<h1 /);
  assert.match(masthead, /aria-label=\{`Open the space \$\{place\.label\}`\}/);
  // At the top even when a short chat's rows sit at the bottom.
  const list = read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx');
  assert.match(list, /\{masthead \? <div className="mb-auto">\{masthead\}<\/div> : null\}/);
});
