import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChatMessage, ConversationMessage } from '@/types/chat';
import { adoptServerFields } from './server-fields';
import type { EngineMessage } from './types';

/* Lawexa's machine held by another chat (thread 38ad195b, Arthur's 5): the
 * server stamps the holder on the turn's saved answer, and the answer drawn
 * from the stream has no such field, so the next read of the chat brings it.
 * Found in the e2e run of 20 November 2026: the card showed only after a
 * reload. TEST DATA. */

const at = new Date('2026-11-20T12:15:30Z');
const HOLDER = { conversation_uuid: 'c-cac', title: 'TEST DATA CAC annual return' };
const answer = (id: string, extra: Partial<ChatMessage & { savedId: number }> = {}): EngineMessage =>
  ({ id, role: 'assistant', content: 'TEST DATA. Another chat is using my machine.', timestamp: at, ...extra }) as EngineMessage;
const saved = (id: number, extra: Partial<ChatMessage> = {}): ConversationMessage =>
  ({ id: `msg_${id}`, role: 'assistant', content: 'TEST DATA. Another chat is using my machine.', timestamp: at, ...extra }) as ConversationMessage;
const holderOf = (row: EngineMessage) => (row as ChatMessage).machineInUse;

test('a streamed answer takes the holder from its saved copy', () => {
  const rows = [answer('local-85', { savedId: 85 })];
  const next = adoptServerFields(rows, [saved(85, { machineInUse: HOLDER })]);
  assert.deepEqual(holderOf(next[0]), HOLDER);
  assert.equal(next[0].id, 'local-85', 'the row on screen keeps its own id');
});

test('an answer read from history takes it by its own id; other answers are left alone', () => {
  const rows = [answer('msg_80'), answer('msg_85')];
  const next = adoptServerFields(rows, [saved(80), saved(85, { machineInUse: HOLDER })]);
  assert.equal(next[0], rows[0]);
  assert.deepEqual(holderOf(next[1]), HOLDER);
});

test('a holder already on screen is kept, and nothing changes when the copy has none', () => {
  const kept = [answer('local-85', { savedId: 85, machineInUse: HOLDER })];
  assert.equal(adoptServerFields(kept, [saved(85, { machineInUse: { conversation_uuid: 'c-x', title: 'TEST DATA other' } })]), kept);
  const plain = [answer('local-85', { savedId: 85 })];
  assert.equal(adoptServerFields(plain, [saved(85)]), plain, 'the same array when nothing changed');
});
