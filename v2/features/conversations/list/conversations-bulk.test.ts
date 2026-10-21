import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ConversationCan } from '@/types/chat';
import { conversationsBulkActions, isBulkSelectable } from './conversations-bulk-model';

/* Bulk select on the chats list (Arthur, 20 October 2026, part 2): tick the
 * reader's own chats and act on them together, with actions that fit what is
 * ticked, a select-all for the current list, and a count before a delete. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const can = (over: Partial<ConversationCan> = {}): ConversationCan => ({
  rename: true,
  move_to_space: true,
  move: false,
  remove: false,
  share: true,
  delete: true,
  ...over,
});

test('the chats list offers what the ticked rows allow', () => {
  assert.deepEqual(conversationsBulkActions([{ can: can(), is_private: false }]), ['space', 'make_private', 'delete']);
  // Already private: nothing to make private.
  assert.deepEqual(conversationsBulkActions([{ can: can(), is_private: true }]), ['space', 'delete']);
  // In a space, the row's own menu says Move, which is still a move.
  assert.deepEqual(
    conversationsBulkActions([{ can: can({ move_to_space: false, move: true }), is_private: true }]),
    ['space', 'delete'],
  );
  // A row that may do neither, and no `can` at all (an older payload), offers nothing for them.
  assert.deepEqual(
    conversationsBulkActions([{ can: can({ move_to_space: false, delete: false }), is_private: true }]),
    [],
  );
  assert.deepEqual(conversationsBulkActions([{ can: undefined, is_private: false }]), ['make_private']);
  // One row that allows it is enough: the server answers the others row by row.
  assert.deepEqual(
    conversationsBulkActions([
      { can: can({ delete: false }), is_private: true },
      { can: can(), is_private: true },
    ]),
    ['space', 'delete'],
  );
  // Nothing ticked: every action shows, off.
  assert.deepEqual(conversationsBulkActions([]), ['space', 'make_private', 'delete']);
});

test('a confidential chat cannot be ticked', () => {
  assert.equal(isBulkSelectable({ is_confidential: true }), false);
  assert.equal(isBulkSelectable({ is_confidential: false }), true);
  assert.equal(isBulkSelectable({}), true);
});

test('each action is one bulk request, and a delete asks first with the count', () => {
  const bulk = read('conversations-bulk.tsx');
  assert.match(bulk, /bulkApi\.conversations\(ticked, \{ action: 'make_private' \}\)/);
  assert.match(bulk, /bulkApi\.conversations\(ticked, \{ action: 'space', spaceUuid: to\?\.uuid \?\? null \}\)/);
  assert.match(bulk, /bulkApi\.conversations\(ticked, \{ action: 'delete' \}\)/);
  assert.equal(bulk.match(/action: 'delete'/g)?.length, 1);
  assert.match(bulk, /title=\{`Delete \$\{countOf\(select\.count, NOUN\)\}\?`\}/);
  // A deleted chat leaves every list and its transcript, as the one-chat delete does.
  assert.match(bulk, /conversationsCache\.remove\(queryClient, id\);\s*queryClient\.removeQueries\(\{ queryKey: \[\.\.\.conversationsQueries\.details\(\), id\] \}\);/);
  assert.match(read('..', '..', 'bulk', 'api.ts'), /post\('\/bulk\/conversations', body\)/);
});

test('a ticked chat row is its own tick box, and the menu steps aside', () => {
  const row = read('ConversationRow.tsx');
  assert.match(row, /\{select \? \(\s*<label[\s\S]*?<Checkbox[\s\S]*?disabled=\{select\.disabled\}/);
  assert.match(row, /\{select \? \(\s*<span aria-hidden className="size-9 shrink-0" \/>\s*\) : hasMenu \?/);
  const list = read('ConversationsList.tsx');
  assert.match(list, /useConversationsBulk\(\{ rows: visibleRows \}\)/);
  assert.match(list, /bulk\.hasSelectable && !bulk\.selecting\s*\? bulk\.startButton\(/);
});
