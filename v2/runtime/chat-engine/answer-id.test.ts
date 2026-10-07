import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerMessageId, stampAnswerId } from './answer-id';
import type { EngineMessage } from './types';

const isLocal = (id: string) => id.startsWith('local_');
const at = new Date('2026-10-07T21:00:00Z');
const user = (id: string): EngineMessage => ({ id, role: 'user', content: 'Draft a motion', timestamp: at });
const answer = (id: string, content = 'Here is the motion'): EngineMessage => ({ id, role: 'assistant', content, timestamp: at });
const handover = (id: string): EngineMessage =>
  ({ id, role: 'assistant', content: '', timestamp: at, messageType: 'handover', agentSlug: 'writer', task: 't', handoverStatus: 'complete' }) as EngineMessage;
const error = (id: string): EngineMessage =>
  ({ id, role: 'assistant', content: 'Failed', timestamp: at, messageType: 'error', errorCode: 'X', retryable: true, retryAfterMs: null }) as EngineMessage;

test("the answer is the turn's largest saved id, in any order", () => {
  assert.equal(answerMessageId([9104, 9101, 9103, 9102]), 9104);
  assert.equal(answerMessageId([]), null);
  assert.equal(answerMessageId(undefined), null);
});

test("the turn's answer row gets the id; earlier turns and other rows do not", () => {
  const messages = [user('msg_1'), answer('msg_2'), user('local_u'), handover('local_h'), answer('local_a')];
  const stamped = stampAnswerId(messages, 9104, isLocal);
  assert.equal(stamped[4].savedId, 9104);
  assert.deepEqual(stamped.slice(0, 4), messages.slice(0, 4));
});

test('a repeated completed event changes nothing', () => {
  const once = stampAnswerId([user('local_u'), answer('local_a')], 9104, isLocal);
  const twice = stampAnswerId(once, 9104, isLocal);
  assert.equal(twice, once);
});

test("no answer in this turn: nothing is stamped, not even the last turn's answer", () => {
  const messages = [user('local_u1'), answer('local_a1'), user('local_u2'), error('local_e')];
  assert.equal(stampAnswerId(messages, 9104, isLocal), messages);
});

test('a history row or an empty answer keeps its state', () => {
  const fromHistory = [user('msg_1'), answer('msg_2')];
  assert.equal(stampAnswerId(fromHistory, 9104, isLocal), fromHistory);
  const empty = [user('local_u'), answer('local_a', '   ')];
  assert.equal(stampAnswerId(empty, 9104, isLocal), empty);
});
