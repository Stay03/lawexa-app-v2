import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EngineMessage } from '@/v2/runtime/chat-engine';
import { groupMessages, type MessageGroup } from './message-groups';
import { openTailStart, splitOpenTail } from './open-tail';

// Guard for speed step 2 (c): the first frame of an open draws the newest
// messages, the rest follows above them, and nothing is dropped or reordered.
// The scroll anchor and the timing are pinned in open-tail.test.ts.

const user = (id: string) => ({ id, role: 'user', content: id }) as unknown as EngineMessage;
const answer = (id: string) => ({ id, role: 'assistant', content: id }) as unknown as EngineMessage;
const step = (id: string) => ({ id, role: 'tool', content: id, tool_name: 'search' }) as unknown as EngineMessage;
const handover = (id: string) => ({ id, role: 'assistant', messageType: 'handover', content: id }) as unknown as EngineMessage;

const ids = (messages: readonly EngineMessage[]) => messages.map((message) => message.id);
const keyOf = (group: MessageGroup) =>
  group.type === 'single' ? group.message.id : group.type === 'tool-chain' ? `tool-${group.messages[0].id}` : `handover-${group.handover.id}`;

/** A chat of `turns` question-and-answer pairs. */
const chat = (turns: number) =>
  Array.from({ length: turns }, (_, i) => [user(`q${i}`), answer(`a${i}`)]).flat();

test('the first frame is the newest N, and the rest is everything before it, in order', () => {
  const messages = chat(20);
  const { older, newest } = splitOpenTail(messages, 8);
  assert.deepEqual(ids(newest), ids(messages.slice(-8)));
  assert.deepEqual(ids([...older, ...newest]), ids(messages), 'nothing dropped, the order unchanged');
});

test('a chat no longer than N draws whole in the first frame', () => {
  for (const messages of [[], chat(1), chat(4)]) {
    const { older, newest } = splitOpenTail(messages, 8);
    assert.equal(older.length, 0);
    assert.deepEqual(ids(newest), ids(messages));
  }
});

test('a cut inside a tool chain moves back to the start of the chain', () => {
  // q0 a0 q1 [t0 t1 t2 t3] a1 q2 a2: the eighth message from the end is t1.
  const messages = [user('q0'), answer('a0'), user('q1'), step('t0'), step('t1'), step('t2'), step('t3'), answer('a1'), user('q2'), answer('a2')];
  assert.equal(openTailStart(messages, 7), 3);
  const { older, newest } = splitOpenTail(messages, 7);
  assert.equal(newest[0].id, 't0');
  assert.deepEqual(ids([...older, ...newest]), ids(messages));
});

test('a cut among the steps a handover spawned moves back to the handover', () => {
  const messages = [user('q0'), handover('h0'), step('t0'), step('t1'), answer('a0'), user('q1'), answer('a1')];
  assert.equal(openTailStart(messages, 4), 1);
});

test('a cut on the first step of a chain, or on a plain row, stays where it is', () => {
  const messages = [user('q0'), answer('a0'), step('t0'), step('t1'), answer('a1')];
  assert.equal(openTailStart(messages, 3), 2);
  assert.equal(openTailStart(messages, 4), 1);
});

test('every group the first frame draws is the same group, by key and content, in the full list', () => {
  const messages = [
    ...chat(3),
    user('q3'), handover('h0'), step('t0'), step('t1'), step('t2'), answer('a3'),
    user('q4'), step('t3'), step('t4'), step('t5'), step('t6'), answer('a4'),
  ];
  for (let count = 1; count <= messages.length; count += 1) {
    const first = groupMessages(splitOpenTail(messages, count).newest);
    const full = groupMessages(messages);
    const tail = full.slice(full.length - first.length);
    assert.deepEqual(first.map(keyOf), tail.map(keyOf), `count ${count}`);
    assert.deepEqual(first, tail, `count ${count}`);
  }
});
