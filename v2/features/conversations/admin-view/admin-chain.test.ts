import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AgentConversation } from '@/types/agent-conversations';
import { adminChainSnapshot } from './admin-chain';

/* The admin view's agents as a closed chain snapshot. TEST DATA. */

const conversation = (id: string, state: 'working' | 'replied' | 'failed' | 'cancelled' | null): AgentConversation =>
  ({
    id,
    parent_conversation_id: 'root-chat',
    agent: { id: 1, name: `TEST DATA ${id}`, slug: id },
    title: `TEST DATA ${id}`,
    depth: 1,
    status: 'running',
    execution_id: `exec-${id}`,
    stream_url: `/api/chat/stream/exec-${id}`,
    started_by_message_id: 10,
    last_reply: null,
    latest_call: state
      ? { state, failure: null, called_by_message_id: 10, called_at: '2026-11-26T01:00:00Z', reply: null }
      : null,
    messages_count: 2,
    can_send: true,
  }) as AgentConversation;

test('each agent reads its newest call, with no turn to follow and nothing staff may do', () => {
  const chain = adminChainSnapshot([conversation('a', 'working'), conversation('b', 'replied'), conversation('c', 'failed'), conversation('d', 'cancelled'), conversation('e', null)]);
  assert.deepEqual(chain.agents.map((entry) => entry.state), ['running', 'replied', 'failed', 'stopped', 'replied']);
  for (const entry of chain.agents) {
    assert.equal(entry.execution_id, null);
    assert.equal(entry.stream_url, null);
    assert.equal(entry.status, 'idle');
    assert.equal(entry.can_send, false);
    assert.equal(entry.waiting_on, null);
  }
});

test('the snapshot is closed: no Stop, clock or queued count', () => {
  const chain = adminChainSnapshot([conversation('a', 'working')]);
  assert.equal(chain.chain_open, false);
  assert.deepEqual(chain.held_messages, []);
});
