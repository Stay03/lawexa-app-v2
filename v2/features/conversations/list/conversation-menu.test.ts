import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ConversationCan } from '@/types/chat';
import {
  CONVERSATION_MENU_LABELS,
  conversationMenuItems,
  conversationRemoveRoute,
} from './conversation-menu';

/* Arthur's "…" menu beside each conversation (Inside a space, 15 October
 * 2026), built from the `can` block the server sets on every chat payload. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const can = (flags: Partial<ConversationCan>): ConversationCan => ({
  rename: false,
  move_to_space: false,
  move: false,
  remove: false,
  share: false,
  delete: false,
  ...flags,
});

test('outside a space: Rename, Move to Space, Share, Delete, in that order', () => {
  // Backend's table: the owner of a personal chat.
  const owner = can({ rename: true, move_to_space: true, share: true, delete: true });
  assert.deepEqual(conversationMenuItems(owner, false), ['rename', 'move_to_space', 'share', 'delete']);
  // A redacted personal chat cannot go into a space.
  const redacted = can({ rename: true, share: true, delete: true });
  assert.deepEqual(conversationMenuItems(redacted, false), ['rename', 'share', 'delete']);
});

test('inside a space: Rename, Move, Remove, Share, Delete, each only when the server allows it', () => {
  const contributor = can({ rename: true, move: true, remove: true, share: true, delete: true });
  assert.deepEqual(conversationMenuItems(contributor, true), ['rename', 'move', 'remove', 'share', 'delete']);
  // A Viewer's own chat: no Move, no Remove.
  const viewer = can({ rename: true, share: true, delete: true });
  assert.deepEqual(conversationMenuItems(viewer, true), ['rename', 'share', 'delete']);
  // The space's Owner on a member's chat: Remove only.
  assert.deepEqual(conversationMenuItems(can({ remove: true }), true), ['remove']);
  // Someone else's published chat, or nothing allowed: no menu.
  assert.deepEqual(conversationMenuItems(can({}), true), []);
});

test('no `can` (an older server) shows nothing rather than a guess', () => {
  assert.deepEqual(conversationMenuItems(undefined, false), []);
  assert.deepEqual(conversationMenuItems(null, true), []);
});

test('Move to Space is never offered inside a space, nor Move or Remove outside one', () => {
  const everything = can({ rename: true, move_to_space: true, move: true, remove: true, share: true, delete: true });
  assert.ok(!conversationMenuItems(everything, true).includes('move_to_space'));
  assert.ok(!conversationMenuItems(everything, false).includes('move'));
  assert.ok(!conversationMenuItems(everything, false).includes('remove'));
});

test('the words are Arthur’s', () => {
  assert.deepEqual(CONVERSATION_MENU_LABELS, {
    rename: 'Rename',
    move_to_space: 'Move to Space',
    move: 'Move',
    remove: 'Remove',
    share: 'Share',
    delete: 'Delete',
  });
});

test('Remove takes your own chat out with the move route, a member’s through the space', () => {
  assert.equal(conversationRemoveRoute(7, 7), 'detach');
  assert.equal(conversationRemoveRoute(7, 9), 'space-item');
  assert.equal(conversationRemoveRoute(7, null), 'space-item');
  const dialog = read('v2', 'features', 'spaces', 'detail', 'content', 'RemoveFromSpaceDialog.tsx');
  assert.match(dialog, /if \(yours\) detach\.mutate\(\{ item, to: null \}, handlers\);\s*else removeItem\.mutate\(item, handlers\);/);
  // Its confirm says the chat goes back to its owner and its files stay.
  assert.match(dialog, /it goes back to \$\{yours \? 'your' : 'its owner’s'\} own chats\. Files sent in it stay in the space\./);
});

test('the lists, the space tab and the header all build the menu from `can`', () => {
  const hook = read('v2', 'features', 'conversations', 'list', 'use-conversation-menu.tsx');
  assert.match(hook, /return conversationMenuItems\(conversation\.can, space !== null\)\.map\(\(id\) => \(\{/);
  assert.match(hook, /route: conversationRemoveRoute\(conversation\.user_id, viewerId\),/);
  const list = read('v2', 'features', 'conversations', 'list', 'ConversationsList.tsx');
  assert.match(list, /const menu = useConversationMenu\(\{/);
  assert.match(list, /\{menu\.dialogs\}/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /useConversationMenu\(\{\s*viewerId,\s*place: \{ uuid: spaceUuid, name: spaceName \},\s*\}\)/);
  assert.match(panel, /\{menu\.dialogs\}/);
  const header = read('v2', 'features', 'conversations', 'conversation', 'ConversationActions.tsx');
  assert.match(header, /conversationMenuItems\(detail\.can, detail\.space != null\)/);
  assert.match(header, /route=\{conversationRemoveRoute\(detail\.user_id, viewerId\)\}/);
  // The row draws what it is handed, Delete last under a rule.
  const row = read('v2', 'features', 'conversations', 'list', 'ConversationRow.tsx');
  assert.match(row, /\{destructive && index > 0 \? <DropdownMenuSeparator \/> : null\}/);
  assert.match(row, /\{CONVERSATION_MENU_LABELS\[action\.id\]\}/);
});
