import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage, BackgroundJobEvent, ChatMessage } from '@/types/chat';
import { heldMarkOf } from '@/lib/utils/held-mark';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import { heldMarkFromSend, heldMarkWords, withHeldReleased } from './held-messages';
import { adoptServerFields } from './server-fields';
import type { EngineMessage } from './types';

/* Messages sent while agents work: held, marked, released. TEST DATA. */

const spotter = { agent_conversation_id: 'spotter', handle: 'issue-spotter-1', agent: { id: 1, name: 'Issue Spotter', slug: 'issue-spotter' } };

test('a held send marks its row with the agent it waits on; any other send gets no mark', () => {
  const message = { id: 1234, content: 'TEST DATA also, is the port liable?', created_at: '2026-11-25T04:50:12+00:00', state: 'held' as const, waiting_on: spotter };
  assert.deepEqual(heldMarkFromSend({ held: true, message }), { waitingOn: 'Issue Spotter' });
  assert.deepEqual(heldMarkFromSend({ message }), { waitingOn: 'Issue Spotter' }, 'the saved state alone is enough');
  assert.deepEqual(heldMarkFromSend({ held: true, message: { ...message, waiting_on: null } }), { waitingOn: null });
  assert.equal(heldMarkFromSend({}), null);
  assert.equal(heldMarkFromSend({ held: false }), null);
});

test('a saved user message is marked while held, never once answered, and never another role', () => {
  assert.deepEqual(heldMarkOf({ role: 'user', state: 'held', waiting_on: spotter }), { waitingOn: 'Issue Spotter' });
  assert.equal(heldMarkOf({ role: 'user', state: 'answered', waiting_on: null }), undefined);
  assert.equal(heldMarkOf({ role: 'user' }), undefined);
  assert.equal(heldMarkOf({ role: 'assistant', state: 'held' }), undefined);
});

test('the answer starting releases exactly the messages it names', () => {
  const rows = [
    { id: 'a', role: 'user', savedId: 41, held: { waitingOn: 'Issue Spotter' } },
    { id: 'b', role: 'user', savedId: 42, held: { waitingOn: 'Issue Spotter' } },
    { id: 'c', role: 'assistant', savedId: 43 },
  ];
  const next = withHeldReleased(rows, [41]);
  assert.equal(next[0].held, undefined);
  assert.ok(!('held' in next[0]));
  assert.deepEqual(next[1].held, { waitingOn: 'Issue Spotter' });
  assert.equal(next[2], rows[2]);
  assert.equal(withHeldReleased(rows, [99]), rows, 'nothing to release returns the same rows');
});

test('the mark names the agent, or the agents when the server could not name one', () => {
  assert.equal(heldMarkWords({ waitingOn: 'Issue Spotter' }), 'Waiting for Issue Spotter’s report');
  assert.equal(heldMarkWords({ waitingOn: null }), 'Waiting for the agents’ report');
});

const saved = (id: number, role: ApiMessage['role'], content: string, extra: Partial<ApiMessage> = {}): ApiMessage => ({
  id,
  conversation_id: 'conv-1',
  agent_id: null,
  role,
  content,
  metadata: {},
  created_at: `2026-11-25T04:5${id}:00Z`,
  ...extra,
});

test('the transcript draws a held message with its mark, and Stop’s row as a return line', () => {
  const rows = transformApiMessages(
    [
      saved(1, 'user', 'TEST DATA. Is the pilot liable?', { state: 'held', waiting_on: spotter }),
      saved(2, 'user', 'TEST DATA. Answered already.', { state: 'answered', answered_by_execution_id: 'exec-1' }),
      saved(3, 'user', 'The person stopped the agents before they replied. Answer the message(s)…', { metadata: { type: 'held_messages_answer' } }),
    ],
    { events: true },
  );
  assert.deepEqual((rows[0] as ChatMessage).held, { waitingOn: 'Issue Spotter' });
  assert.equal((rows[1] as ChatMessage).held, undefined);
  const line = rows[2] as BackgroundJobEvent;
  assert.equal(line.role, 'event');
  assert.equal(line.eventType, 'background_job_result', 'the answer starts from it, as from a return');
  assert.equal(line.stoppedForHeld, true);
  assert.deepEqual(line.jobs, []);
});

test('a re-read clears the mark of a message a turn answered, and gives one to a held message drawn without it', () => {
  const local = [
    { id: 'local-1', role: 'user', content: 'TEST DATA. Is the pilot liable?', timestamp: new Date(), savedId: 1, held: { waitingOn: 'Issue Spotter' } },
    { id: 'local-2', role: 'user', content: 'TEST DATA. And the port?', timestamp: new Date(), savedId: 2 },
  ] as unknown as EngineMessage[];
  const server = transformApiMessages(
    [
      saved(1, 'user', 'TEST DATA. Is the pilot liable?', { state: 'answered', answered_by_execution_id: 'exec-1' }),
      saved(2, 'user', 'TEST DATA. And the port?', { state: 'held', waiting_on: spotter }),
    ],
    { events: true },
  );
  const next = adoptServerFields(local, server) as unknown as ChatMessage[];
  assert.ok(!('held' in next[0]), 'answered: the mark goes');
  assert.deepEqual(next[1].held, { waitingOn: 'Issue Spotter' });
  assert.equal(next[0].id, 'local-1', 'the local rows stay');
});

test('a held send marks its row before the turn ends with no reply coming, so nothing streams for it', () => {
  const engine = readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');
  assert.match(
    engine,
    /const held = heldMarkFromSend\(response\.data\);\s*if \(held\) \{\s*setMessages\(\(msgs\) => msgs\.map\(\(m\) => \(m\.id === optimisticMsg\.id \? \{ \.\.\.m, held \} : m\)\)\);\s*\}[\s\S]{0,400}?if \(!expectsAiReply\(response\.data\)\) \{/,
  );
  // The answer starting releases the marks; the open chat follows it (controller).
  assert.match(engine, /function releaseHeld\(savedIds: readonly number\[\]\): boolean \{/);
  const controller = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'useConversationController.ts'), 'utf8');
  assert.match(
    controller,
    /onHeldMessagesAnswered\(\(event\) => \{\s*if \(event\.conversation_id !== conversationId\) return;\s*releaseHeld\(event\.message_ids\);\s*if \(!streamingNowRef\.current\) followResumedTurn\(event\.execution_id\);/,
  );
});
