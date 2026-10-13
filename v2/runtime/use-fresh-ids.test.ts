import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshAgainst } from './use-fresh-ids';

/*
 * A chat moving to the top of a list must not make the rows it passed blink.
 * React moves those rows with insertBefore, and a moved element replays its CSS
 * entrance from opacity 0 (list-order3, 13 October 2026). Only a row the list
 * has not shown before gets the entrance class.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (...parts: string[]) =>
  readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('a move makes no row fresh; a new row is fresh; a first list is all fresh', () => {
  const shown = new Set(['a', 'b', 'c', 'd']);
  assert.deepEqual([...freshAgainst(shown, ['c', 'a', 'b', 'd'])], [], 'c moved to the top');
  assert.deepEqual([...freshAgainst(shown, ['n', 'a', 'b', 'c', 'd'])], ['n'], 'a new chat');
  assert.deepEqual([...freshAgainst(shown, ['a', 'b'])], [], 'rows removed');
  assert.deepEqual([...freshAgainst(new Set(), ['a', 'b'])], ['a', 'b'], 'the skeleton, then rows');
});

test('the hook keeps the last list as state and compares it during render', () => {
  const hook = read('v2', 'runtime', 'use-fresh-ids.ts');
  assert.match(hook, /if \(state\.key !== key\) \{\s*const fresh = freshAgainst\(state\.shown, ids\);/);
  // The first render shows every row as fresh, so a first load still fades in.
  assert.match(hook, /const all: ReadonlySet<string> = new Set\(ids\);\s*return \{ key, shown: all, fresh: all \};/);
});

test('the rail, the drawer and the chats page fade only a fresh row', () => {
  const FADE = "'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300'";
  const sidebar = read('v2', 'shell', 'V2Sidebar.tsx');
  assert.match(sidebar, /const freshIds = useFreshIds\(recents\.map\(\(row\) => row\.id\)\);/);
  assert.ok(sidebar.includes(`freshIds.has(conversation.id) &&\n                          ${FADE}`), 'the rail row');
  // Hooks are unconditional: the call sits above the rail's mobile early return.
  assert.ok(sidebar.indexOf('useFreshIds(') < sidebar.indexOf('if (isMobile) return null;'));

  const drawer = read('v2', 'shell', 'V2Drawer.tsx');
  assert.match(drawer, /const freshIds = useFreshIds\(recents\.map\(\(row\) => row\.id\)\);/);
  assert.ok(drawer.includes(`freshIds.has(conversation.id) &&\n                            ${FADE}`), 'the drawer row');

  // No row keeps the fade unconditionally.
  for (const [name, source] of [['rail', sidebar], ['drawer', drawer]] as const) {
    assert.equal(source.split(FADE).length - 1, 1, `${name}: one fade, behind freshIds`);
  }

  const list = read('v2', 'features', 'conversations', 'list', 'ConversationsList.tsx');
  assert.match(list, /const freshIds = useFreshIds\(presented\.map\(\(\{ row \}\) => row\.id\)\);/);
  assert.match(list, /reveal=\{revealRows && freshIds\.has\(conversation\.id\)\}/);
});
