import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AdminTurnUsage, AdminViewMessage } from '../../../types/admin-conversation-view';
import { callsLine, cutResults, fundingLine, planLine, rowIdOf, tokensLine, turnFactsByRow } from './admin-view-model';

/* TEST DATA throughout. */

function usage(over: Partial<AdminTurnUsage> = {}): AdminTurnUsage {
  return {
    prompt_tokens: 1000,
    completion_tokens: 200,
    total_tokens: 1200,
    estimated_cost: 0.01,
    actual_cost: 0.012,
    provider: 'test',
    cost: 0.012,
    latency_ms: 1500,
    model: { id: 1, name: 'Test Model A', model_id: 'test-a' },
    ...over,
  };
}

function row(id: number, role: AdminViewMessage['role'], over: Partial<AdminViewMessage> = {}): AdminViewMessage {
  return {
    id,
    conversation_id: 'c-test',
    agent_id: null,
    role,
    content: `TEST DATA row ${id}`,
    metadata: null,
    created_at: '2026-11-25T20:00:00Z',
    ...over,
  } as AdminViewMessage;
}

test('a turn sums every call between two questions and shows under its last answer on screen', () => {
  const messages = [
    row(1, 'user', { attribution: { kind: 'plan_paid', plan: { id: 2, name: 'Pro', slug: 'pro' } } }),
    row(2, 'assistant', { usage: usage() }),
    row(3, 'tool'),
    row(4, 'assistant', { usage: usage({ actual_cost: null, cost: 0.02, latency_ms: 4200, model: { id: 2, name: 'Test Model B', model_id: 'test-b' } }) }),
    row(5, 'user'),
    row(6, 'assistant', { usage: usage({ latency_ms: null }) }),
  ];
  const facts = turnFactsByRow(messages, new Set([rowIdOf(2), rowIdOf(4), rowIdOf(6)]));
  assert.deepEqual([...facts.keys()], ['msg_4', 'msg_6']);
  const first = facts.get('msg_4')!;
  assert.equal(first.promptTokens, 2000);
  assert.equal(first.completionTokens, 400);
  assert.equal(Math.round(first.cost * 1000), 32);
  assert.equal(first.estimated, true);
  assert.equal(first.calls, 2);
  assert.deepEqual(first.models, ['Test Model A', 'Test Model B']);
  assert.equal(first.slowestMs, 4200);
  assert.equal(first.funding?.kind, 'plan_paid');
  const second = facts.get('msg_6')!;
  assert.equal(second.estimated, false);
  assert.equal(second.slowestMs, null);
  assert.equal(second.funding, null);
});

test('a turn whose answer is not on screen gets no line', () => {
  const facts = turnFactsByRow([row(1, 'user'), row(2, 'assistant', { usage: usage() })], new Set());
  assert.equal(facts.size, 0);
});

test('a turn with no usage gets no line', () => {
  const facts = turnFactsByRow([row(1, 'user'), row(2, 'assistant')], new Set([rowIdOf(2)]));
  assert.equal(facts.size, 0);
});

test('the lines read as plain words', () => {
  assert.equal(tokensLine({ promptTokens: 12040, completionTokens: 388 }), '12,040 in, 388 out');
  assert.equal(callsLine({ calls: 3, slowestMs: 4210 }), '3 calls, slowest 4.2 s');
  assert.equal(callsLine({ calls: 1, slowestMs: 900 }), '1 call, 900 ms');
  assert.equal(callsLine({ calls: 2, slowestMs: null }), '2 calls');
});

test('funding names the plan and the sponsor, and keeps a kind it does not know', () => {
  assert.equal(fundingLine({ kind: 'plan_paid', plan: { id: 1, name: 'Pro', slug: 'pro' } }), 'Paid plan (Pro)');
  assert.equal(
    fundingLine({ kind: 'plan_granted', plan: { id: 1, name: 'Pro', slug: 'pro' }, sponsor: { id: 3, name: 'Test Sponsor', slug: 'ts' } }),
    'Granted plan (Pro), sponsor Test Sponsor',
  );
  assert.equal(fundingLine({ kind: 'new_kind' }), 'new kind');
});

test('the plan line says the subscription state, or the plan alone', () => {
  assert.equal(planLine({ plan: { slug: 'pro', name: 'Pro' }, subscription_status: 'past_due' }), 'Pro, payment overdue');
  assert.equal(planLine({ plan: { slug: 'free', name: 'Free' }, subscription_status: null }), 'Free');
  assert.equal(planLine({ plan: null, subscription_status: null }), 'No plan');
});

test('cut tool results are found by their mark', () => {
  const messages = [row(1, 'tool', { metadata: { result_truncated: true } as never }), row(2, 'tool')];
  assert.deepEqual(cutResults(messages), [1]);
});
