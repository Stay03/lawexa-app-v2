import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chatErrorChat } from './chat-error-chat';

/* The chat error row's way to its chat (Stay chose A, 21 October 2026;
 * backend chat-error-links). */

const row = (overrides: Parameters<typeof chatErrorChat>[0]) => chatErrorChat(overrides);

test('a chat in no Space and no channel links to the admin chat view', () => {
  assert.deepEqual(
    row({ conversation_id: 7, conversation_uuid: 'c-1', admin_viewable: true, space_id: null }),
    { kind: 'link', href: '/admin/conversations/c-1' },
  );
});

test('a Space or channel chat says why there is no link', () => {
  assert.deepEqual(
    row({ conversation_id: 7, conversation_uuid: 'c-1', admin_viewable: false, space_id: 3 }),
    { kind: 'note', text: 'In a Space, not viewable by admin' },
  );
  assert.deepEqual(
    row({ conversation_id: 7, conversation_uuid: 'c-1', admin_viewable: false, space_id: null }),
    { kind: 'note', text: 'In a channel, not viewable by admin' },
  );
});

test('a deleted chat says so; a row with no chat, or an older server, says nothing', () => {
  assert.deepEqual(
    row({ conversation_id: 7, conversation_uuid: null, admin_viewable: false, space_id: null }),
    { kind: 'note', text: 'Chat deleted' },
  );
  assert.equal(
    row({ conversation_id: null, conversation_uuid: null, admin_viewable: false, space_id: null }),
    null,
  );
  assert.equal(row({ conversation_id: 7, space_id: null }), null);
});
