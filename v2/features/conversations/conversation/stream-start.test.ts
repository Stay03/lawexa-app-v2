import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EngineMessage } from '@/v2/runtime/chat-engine';
import { computeStreamStart } from './stream-start';

const at = (hms: string) => new Date(`2026-09-27T${hms}Z`);
const user = (id: string, hms: string): EngineMessage => ({ id, role: 'user', content: 'q', timestamp: at(hms) });
const answer = (id: string, hms: string, isStreaming = false): EngineMessage => ({
  id,
  role: 'assistant',
  content: 'a',
  timestamp: at(hms),
  isStreaming,
});
const tool = (id: string, hms: string): EngineMessage => ({
  id,
  role: 'tool',
  content: '',
  timestamp: at(hms),
  toolName: 'search_cases',
  toolParameters: {},
  toolStatus: 'complete',
});
const handover = (id: string, hms: string): EngineMessage => ({
  id,
  role: 'assistant',
  content: '',
  timestamp: at(hms),
  messageType: 'handover',
  agentSlug: 'quiz',
  task: 'mark',
  handoverStatus: 'active',
});

test('a follow-up after a pause times from its own work, not the earlier turn', () => {
  // The Sep 27 quiz: the earlier turn's tools at 21:50–21:51, the Submit at 21:57:32.
  const messages = [
    user('u1', '21:50:40'),
    tool('t1', '21:50:45'),
    handover('h1', '21:50:50'),
    answer('a1', '21:51:06'),
    user('u2', '21:57:32'),
    tool('t2', '21:57:33'),
    answer('a2', '21:57:34', true),
  ];
  assert.equal(computeStreamStart(messages), at('21:57:33').getTime());
});

test('a follow-up with no tool call yet times from its streaming placeholder', () => {
  const messages = [user('u1', '21:50:40'), tool('t1', '21:50:45'), answer('a1', '21:51:06'), user('u2', '21:57:32'), answer('a2', '21:57:32', true)];
  assert.equal(computeStreamStart(messages), at('21:57:32').getTime());
});

test('a follow-up that has not started work has no start yet', () => {
  const messages = [user('u1', '21:50:40'), tool('t1', '21:50:45'), answer('a1', '21:51:06'), user('u2', '21:57:32')];
  assert.equal(computeStreamStart(messages), null);
});

test('a handover counts as the turn starting work', () => {
  const messages = [user('u1', '21:50:40'), handover('h1', '21:50:41'), tool('t1', '21:50:45'), answer('a1', '21:50:46', true)];
  assert.equal(computeStreamStart(messages), at('21:50:41').getTime());
});

test('a list with no user message looks at every message', () => {
  const messages = [answer('a0', '21:40:00'), tool('t1', '21:40:05'), answer('a1', '21:40:06', true)];
  assert.equal(computeStreamStart(messages), at('21:40:05').getTime());
});

test('an empty list has no start', () => {
  assert.equal(computeStreamStart([]), null);
});
