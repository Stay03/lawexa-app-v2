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
  // Data attributes on a fixed class (ShellFrame's docblock: a class change on
  // the root restyled the whole page).
  assert.match(frame, /className="v2-shell"/);
  assert.match(frame, /data-v2-open-bar=\{hasOpenBar\(pathname\) \? '' : undefined\}/);
  assert.match(frame, /data-v2-chat=\{isChatRoute\(pathname\) \? '' : undefined\}/);
  // As code, not as the history the docblock tells.
  assert.doesNotMatch(frame, /'v2-shell--(open|chat)'/);
  assert.doesNotMatch(read('v2', 'shell', 'shell.css'), /\.v2-shell--(open|chat)/);
  const header = read('v2', 'shell', 'V2Header.tsx');
  assert.match(header, /const isTopLevel = hasOpenBar\(path\);/);
  // The move-first clear still keys on top-level screens only.
  assert.match(read('v2', 'shell', 'move-first.tsx'), /if \(isTopLevelRoute\(pathname\)\) clearHeaderContext\(\);/);
});

test('on a phone the bar room moves into the chat: its frame below the buttons, the transcript scrolling under them', () => {
  const css = read('v2', 'shell', 'shell.css');
  const phone = css.slice(css.indexOf('@media (max-width: 47.999rem)'));
  assert.match(phone, /html\.v2-document-lock \.v2-shell\[data-v2-chat\] \.v2-shell__content \{\s*padding-top: 0;\s*\}/);
  assert.match(phone, /html\.v2-document-lock \.v2-shell\[data-v2-chat\] \[data-v2-chat-frame\] \{\s*padding-top: var\(--v2-bar-h\);\s*\}/);
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

test('a chat draws no title and no space at its top, in the skeleton or the loaded page (Stay, 15 October 2026)', () => {
  const screen = read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  assert.match(screen, /masthead=\{embed \? null : <ConversationMasthead \/>\}/);
  // Below the confidential banner, the transcript does not pull up under the bar.
  assert.match(screen, /underBar=\{!embed && !controller\.isConfidential\}/);
  // The masthead is a heading for screen readers only: no visible title, no
  // space link, no title-shaped shimmer while the title resolves.
  const masthead = read('v2', 'features', 'conversations', 'conversation', 'ConversationMasthead.tsx');
  assert.match(masthead, /const \{ title, confidential \} = useHeaderContext\(\);/);
  assert.match(masthead, /if \(title === null\) return null;/);
  assert.match(masthead, /<h1 className="sr-only">/);
  assert.equal((masthead.match(/<h1/g) ?? []).length, 1);
  for (const gone of [/useHeaderPlace/, /<Link/, /animate-pulse/, /Open the space/]) assert.doesNotMatch(masthead, gone);
  // No wrapper box: it would take a row of the column and push the first message down.
  const list = read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx');
  assert.match(list, /\r?\n\s*\{masthead\}\r?\n/);
  assert.doesNotMatch(list, /<div className="mb-auto">\{masthead\}<\/div>/);
  // The shared skeletons (route boundary, history, move-first frame) draw no title line either.
  assert.doesNotMatch(read('v2', 'features', 'conversations', 'conversation', 'skeletons.tsx'), /h-7 w-2\/3/);
});

test('the sidebar and the drawer name the space under a recent chat, as the chats list does (Stay, 15 October 2026)', async () => {
  const { recentSpaceName } = await import('./recent-chat-space');
  const space = { uuid: 's1', name: 'Adeyemi chambers' };
  assert.equal(recentSpaceName({ space, is_confidential: false }), 'Adeyemi chambers');
  // A confidential chat names no space, as its list row does not.
  assert.equal(recentSpaceName({ space, is_confidential: true }), null);
  assert.equal(recentSpaceName({ space: null }), null);
  assert.equal(recentSpaceName({}), null);
  const label = read('v2', 'shell', 'recent-chat-label.tsx');
  assert.match(label, /if \(!spaceName\) return <span className="truncate">\{title\}<\/span>;/);
  assert.match(label, /<Boxes aria-hidden className="size-3! shrink-0" \/>\s*<span className="sr-only">, in <\/span>\s*<span className="truncate">\{spaceName\}<\/span>/);
  const sidebar = read('v2', 'shell', 'V2Sidebar.tsx');
  assert.match(sidebar, /const spaceName = recentSpaceName\(conversation\);/);
  assert.match(sidebar, /size=\{spaceName \? 'lg' : 'default'\}/);
  assert.match(sidebar, /<RecentChatLabel title=\{title\} spaceName=\{spaceName\} \/>/);
  assert.match(read('v2', 'shell', 'V2Drawer.tsx'), /<RecentChatLabel title=\{title\} spaceName=\{recentSpaceName\(conversation\)\} \/>/);
});
