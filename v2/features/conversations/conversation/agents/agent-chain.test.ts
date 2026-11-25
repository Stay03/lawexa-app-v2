import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AgentChainEntry } from '@/types/agent-chain';
import { CHAIN_POLL_MS, agentsWorkingWords, chainPollMs, chainRowWords, chainRowsByMessage } from './agent-chain';

/* The live agent list: agents nested under the turn that called them. TEST DATA. */

const ROOT = 'root-chat';
const agent = (id: number, name: string) => ({ id, name, slug: name.toLowerCase().replace(/\s+/g, '-') });

interface Shape {
  id: string;
  parent: string;
  depth: number;
  name?: string;
  state?: AgentChainEntry['state'];
  waitingOn?: string;
  executionId?: string | null;
  calledBy?: number | null;
  canSend?: boolean;
  reply?: { message_id: number; preview: string } | null;
}
function entry(s: Shape): AgentChainEntry {
  const state = s.state ?? 'running';
  const executionId = s.executionId ?? null;
  return {
    id: s.id,
    parent_conversation_id: s.parent,
    agent: agent(1, s.name ?? 'Issue Spotter'),
    title: `TEST DATA ${s.id}`,
    depth: s.depth,
    status: executionId ? 'running' : 'idle',
    execution_id: executionId,
    stream_url: null,
    started_by_message_id: s.calledBy ?? 10,
    last_reply: null,
    latest_call: {
      state: state === 'running' || state === 'waiting' ? 'working' : state === 'stopped' ? 'cancelled' : state,
      failure: state === 'failed' ? 'no_reply' : null,
      called_by_message_id: s.calledBy === undefined ? 10 : s.calledBy,
      called_at: '2026-11-25T04:00:00Z',
      reply: s.reply ? { ...s.reply, created_at: '2026-11-25T04:01:00Z' } : null,
    },
    messages_count: 2,
    can_send: s.canSend ?? true,
    created_at: '2026-11-25T04:00:00Z',
    last_message_at: null,
    state,
    waiting_on: s.waitingOn ? { agent_conversation_id: s.waitingOn, handle: s.waitingOn, agent: agent(2, 'Law Checker') } : null,
  };
}

const spotter = entry({ id: 'spotter', parent: ROOT, depth: 1, state: 'waiting', waitingOn: 'checker' });
const checker = entry({ id: 'checker', parent: 'spotter', depth: 2, name: 'Law Checker', executionId: 'exec-checker', calledBy: 55 });

test('the law checker sits under the Issue Spotter, which sits under the turn that called it', () => {
  const rows = chainRowsByMessage({ agents: [spotter, checker] }, ROOT);
  assert.deepEqual([...rows.keys()], [10]);
  const [top] = rows.get(10)!;
  assert.equal(top.name, 'Issue Spotter');
  assert.equal(top.words, 'Waiting for Law Checker');
  assert.equal(top.executionId, null, 'a waiting agent has no turn to stream');
  assert.equal(top.children.length, 1);
  assert.equal(top.children[0].name, 'Law Checker');
  assert.equal(top.children[0].words, 'Working');
  assert.equal(top.children[0].executionId, 'exec-checker');
  assert.equal(top.children[0].canStop, true);
});

test('an agent whose parent is not in the list, or whose depth does not follow, is left out', () => {
  const lost = entry({ id: 'lost', parent: 'gone', depth: 2 });
  const wrongDepth = entry({ id: 'deep', parent: 'spotter', depth: 3 });
  const rows = chainRowsByMessage({ agents: [spotter, lost, wrongDepth] }, ROOT);
  assert.equal(rows.get(10)![0].children.length, 0);
  assert.equal([...rows.values()].flat().length, 1);
});

test('two agents called in one turn are two rows in order; a later turn gets its own', () => {
  const a = entry({ id: 'a', parent: ROOT, depth: 1 });
  const b = entry({ id: 'b', parent: ROOT, depth: 1, name: 'Drafter' });
  const c = entry({ id: 'c', parent: ROOT, depth: 1, name: 'Researcher', calledBy: 20 });
  const gone = entry({ id: 'd', parent: ROOT, depth: 1, calledBy: null });
  const rows = chainRowsByMessage({ agents: [a, b, c, gone] }, ROOT);
  assert.deepEqual(rows.get(10)!.map((r) => r.name), ['Issue Spotter', 'Drafter']);
  assert.deepEqual(rows.get(20)!.map((r) => r.name), ['Researcher']);
  assert.equal(rows.size, 2, 'an agent whose calling message is gone has no row');
});

test('a reply shows its start; Stop shows only on a running agent this reader may stop', () => {
  const replied = entry({ id: 'r', parent: ROOT, depth: 1, state: 'replied', reply: { message_id: 7, preview: '**TEST DATA** report' } });
  const watched = entry({ id: 'w', parent: ROOT, depth: 1, executionId: 'exec-w', canSend: false });
  const [r, w] = chainRowsByMessage({ agents: [replied, watched] }, ROOT).get(10)!;
  assert.equal(r.replyStart, 'TEST DATA report');
  assert.equal(r.replyMessageId, 7);
  assert.equal(r.executionId, null);
  assert.equal(w.executionId, 'exec-w');
  assert.equal(w.canStop, false);
});

test('in the Issue Spotter’s side panel, the law checker sits under the Issue Spotter’s own turn', () => {
  const rows = chainRowsByMessage({ agents: [spotter, checker] }, 'spotter', { parentDepth: 1, parentName: 'Issue Spotter' });
  assert.deepEqual([...rows.keys()], [55]);
  assert.equal(rows.get(55)![0].name, 'Law Checker');
  assert.equal(chainRowsByMessage({ agents: [spotter, checker] }, 'spotter').size, 0, 'a parent read at the wrong depth draws nothing');
});

test('the words for each state; a failure names who carried on', () => {
  assert.equal(chainRowWords('stopped', null, 'Lawexa'), 'Stopped');
  assert.equal(chainRowWords('failed', null, 'Lawexa'), 'Couldn’t reply. Lawexa carried on without it');
  const failedChecker = entry({ id: 'checker', parent: 'spotter', depth: 2, name: 'Law Checker', state: 'failed' });
  const [top] = chainRowsByMessage({ agents: [spotter, failedChecker] }, ROOT).get(10)!;
  assert.equal(top.children[0].words, 'Couldn’t reply. Issue Spotter carried on without it');
});

test('the fallback beat runs only while the chain is open and nothing pushes', () => {
  assert.equal(chainPollMs({ chain_open: true }, false), CHAIN_POLL_MS);
  assert.equal(chainPollMs({ chain_open: true }, true), false);
  assert.equal(chainPollMs({ chain_open: false }, false), false);
  assert.equal(chainPollMs(undefined, false), false);
});

test('the foot line names the agents the chat waits for, and how many messages are held', () => {
  const drafter = entry({ id: 'drafter', parent: ROOT, depth: 1, name: 'Drafter' });
  const done = entry({ id: 'done', parent: ROOT, depth: 1, name: 'Researcher', state: 'replied' });
  const held = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, created_at: '2026-11-25T04:50:00Z', waiting_on: spotter.waiting_on! }));
  assert.equal(agentsWorkingWords({ agents: [spotter, checker], held_messages: [] }), 'Waiting for Issue Spotter');
  assert.equal(agentsWorkingWords({ agents: [spotter, drafter, done], held_messages: held(1) }), 'Waiting for Issue Spotter and Drafter. 1 message waits for the report');
  assert.equal(agentsWorkingWords({ agents: [], held_messages: held(2) }), 'Waiting for the agents. 2 messages wait for the report');
});
