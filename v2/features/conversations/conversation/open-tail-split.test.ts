import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EngineMessage } from '@/v2/runtime/chat-engine';
import { groupMessages, type MessageGroup } from './message-groups';
import { openTailStart, splitOpenTail, type OpenTailLimit } from './open-tail';

// Guard for speed step 2 (c) and step 3 (a): the first frame of an open draws
// the newest messages, up to a text budget, the rest follows above them, and
// nothing is dropped or reordered. The scroll anchor and the timing are pinned
// in open-tail.test.ts.

const user = (id: string, content = id) => ({ id, role: 'user', content }) as unknown as EngineMessage;
const answer = (id: string, content = id) => ({ id, role: 'assistant', content }) as unknown as EngineMessage;
const step = (id: string, content = id) => ({ id, role: 'tool', content, tool_name: 'search' }) as unknown as EngineMessage;
const handover = (id: string, content = id) =>
  ({ id, role: 'assistant', messageType: 'handover', content }) as unknown as EngineMessage;

const ids = (messages: readonly EngineMessage[]) => messages.map((message) => message.id);
const keyOf = (group: MessageGroup) =>
  group.type === 'single' ? group.message.id : group.type === 'tool-chain' ? `tool-${group.messages[0].id}` : `handover-${group.handover.id}`;

/** A limit the short contents above never reach, so the count alone cuts. */
const upTo = (messages: number, chars = 3_000): OpenTailLimit => ({ messages, chars });

/** A chat of `turns` question-and-answer pairs. */
const chat = (turns: number) =>
  Array.from({ length: turns }, (_, i) => [user(`q${i}`), answer(`a${i}`)]).flat();

/** A chat of `turns` pairs: ten-character questions, answers `chars` long. */
const longChat = (turns: number, chars: number) =>
  Array.from({ length: turns }, (_, i) => [user(`q${i}`, 'a question'), answer(`a${i}`, 'x'.repeat(chars))]).flat();

test('the first frame is the newest N, and the rest is everything before it, in order', () => {
  const messages = chat(20);
  const { older, newest } = splitOpenTail(messages, upTo(8));
  assert.deepEqual(ids(newest), ids(messages.slice(-8)));
  assert.deepEqual(ids([...older, ...newest]), ids(messages), 'nothing dropped, the order unchanged');
});

test('a chat no longer than N draws whole in the first frame', () => {
  for (const messages of [[], chat(1), chat(4)]) {
    const { older, newest } = splitOpenTail(messages, upTo(8));
    assert.equal(older.length, 0);
    assert.deepEqual(ids(newest), ids(messages));
  }
});

test('older messages are added until the text drawn reaches the budget', () => {
  // a5 (1,000), q5 (1,010), a4 (2,010), q4 (2,020), a3 (3,020) reaches 3,000: q3 is not added.
  const messages = longChat(6, 1_000);
  const { older, newest } = splitOpenTail(messages, upTo(8, 3_000));
  assert.deepEqual(ids(newest), ['a3', 'q4', 'a4', 'q5', 'a5']);
  assert.deepEqual(ids([...older, ...newest]), ids(messages));
});

test('the newest message always draws, even one longer than the budget', () => {
  const messages = [user('q0', 'a question'), answer('a0', 'x'.repeat(5_000))];
  assert.deepEqual(ids(splitOpenTail(messages, upTo(8, 3_000)).newest), ['a0']);
});

test('the count still caps a chat of short messages under the budget', () => {
  const messages = longChat(10, 100);
  assert.equal(splitOpenTail(messages, upTo(8, 3_000)).newest.length, 8);
});

test('a tool chain and a handover draw their titles, so they count no text', () => {
  // The budget is 100: the 1,000-character step results and handover do not
  // reach it; a1, q1 and a0 (30, 10 and 60) do, so q0 is left for the fill.
  const messages = [
    user('q0', 'a question'),
    answer('a0', 'x'.repeat(60)),
    user('q1', 'a question'),
    handover('h0', 'y'.repeat(1_000)),
    step('t0', 'z'.repeat(1_000)),
    step('t1', 'z'.repeat(1_000)),
    answer('a1', 'x'.repeat(30)),
  ];
  assert.deepEqual(ids(splitOpenTail(messages, upTo(8, 100)).newest), ['a0', 'q1', 'h0', 't0', 't1', 'a1']);
});

test('the budget stops only on a message with text, so it never cuts a chain', () => {
  const messages = [user('q0', 'a question'), handover('h0'), step('t0'), step('t1'), answer('a0', 'x'.repeat(50)), user('q1', 'a question')];
  // 60 characters after a0 are under 100: the chain and the question before it draw too.
  assert.equal(openTailStart(messages, upTo(8, 100)), 0);
  // 60 reach 55 at a0: the cut is on a0, with the chain above it left for the fill.
  assert.equal(openTailStart(messages, upTo(8, 55)), 4);
});

test('a cut inside a tool chain moves back to the start of the chain', () => {
  // q0 a0 q1 [t0 t1 t2 t3] a1 q2 a2: the eighth message from the end is t1.
  const messages = [user('q0'), answer('a0'), user('q1'), step('t0'), step('t1'), step('t2'), step('t3'), answer('a1'), user('q2'), answer('a2')];
  assert.equal(openTailStart(messages, upTo(7)), 3);
  const { older, newest } = splitOpenTail(messages, upTo(7));
  assert.equal(newest[0].id, 't0');
  assert.deepEqual(ids([...older, ...newest]), ids(messages));
});

test('a cut among the steps a handover spawned moves back to the handover', () => {
  const messages = [user('q0'), handover('h0'), step('t0'), step('t1'), answer('a0'), user('q1'), answer('a1')];
  assert.equal(openTailStart(messages, upTo(4)), 1);
});

test('a cut on the first step of a chain, or on a plain row, stays where it is', () => {
  const messages = [user('q0'), answer('a0'), step('t0'), step('t1'), answer('a1')];
  assert.equal(openTailStart(messages, upTo(3)), 2);
  assert.equal(openTailStart(messages, upTo(4)), 1);
});

test('every group the first frame draws is the same group, by key and content, in the full list', () => {
  const messages = [
    ...chat(3),
    user('q3'), handover('h0'), step('t0'), step('t1'), step('t2'), answer('a3'),
    user('q4'), step('t3'), step('t4'), step('t5'), step('t6'), answer('a4'),
  ];
  for (let count = 1; count <= messages.length; count += 1) {
    const first = groupMessages(splitOpenTail(messages, upTo(count)).newest);
    const full = groupMessages(messages);
    const tail = full.slice(full.length - first.length);
    assert.deepEqual(first.map(keyOf), tail.map(keyOf), `count ${count}`);
    assert.deepEqual(first, tail, `count ${count}`);
  }
});
