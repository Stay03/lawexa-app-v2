import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentConversation } from '@/types/agent-conversations';
import type { BackgroundJob } from '@/types/background-jobs';
import type { ApiMessage } from '@/types/chat';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { EngineMessage } from '@/v2/runtime/chat-engine/types';
import { groupMessages, turnEndPlaces } from '../message-groups';
import { savedIdOf } from '../reply-target';
import { AGENT_ROW_WORDS, agentInitials, agentRows, agentRowState, rosterNeedsList } from './agent-roster';

/* C1 (Stay, 12 November 2026, 17:47Z): each agent Lawexa messaged is a row
 * after the turn's answer, with its state, its own Stop while it works, and
 * its words streaming in. TEST DATA only. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', ...parts), 'utf8');

const SPOTTER = { id: 231, name: 'Issue Spotter', slug: 'issue-spotter' };
const EXPERT = { id: 229, name: 'Expert', slug: 'expert' };
const SPOTTER_CHAT = '7e1a0000-0000-4000-8000-000000000001';
const EXPERT_CHAT = '8f2b0000-0000-4000-8000-000000000002';

const job = (patch: Partial<BackgroundJob> = {}): BackgroundJob => ({
  id: 'job-1',
  kind: 'agent_reply',
  kind_name: 'message to another agent',
  status: 'running',
  progress: null,
  started_at: '2026-11-12T09:12:03+00:00',
  finished_at: null,
  started_by_message_id: 81234,
  wake: null,
  failure: null,
  agent_conversation: { id: SPOTTER_CHAT, agent: SPOTTER },
  ...patch,
});

const entry = (patch: Partial<AgentConversation> = {}): AgentConversation => ({
  id: SPOTTER_CHAT,
  parent_conversation_id: 'c0000000-0000-4000-8000-000000000001',
  agent: SPOTTER,
  title: 'TEST DATA tenancy issues',
  depth: 1,
  status: 'running',
  execution_id: 'exec-1',
  stream_url: '/api/chat/stream/exec-1',
  started_by_message_id: 81234,
  last_reply: null,
  messages_count: 1,
  can_send: true,
  created_at: '2026-11-12T09:12:03+00:00',
  last_message_at: null,
  ...patch,
});

test('an agent row reads Writing, Replied, Stopped or Couldn’t reply from its job', () => {
  assert.equal(agentRowState(job()), 'writing');
  assert.equal(agentRowState(job({ status: 'succeeded', wake: 'pending' })), 'replied');
  assert.equal(agentRowState(job({ status: 'succeeded', wake: 'woken' })), 'replied');
  assert.equal(agentRowState(job({ status: 'failed', failure: 'stopped' })), 'stopped');
  for (const failure of ['no_reply', 'error', 'gone', 'wake_abandoned'] as const) {
    assert.equal(agentRowState(job({ status: 'failed', failure })), 'failed', failure);
  }
  // No reason sent: never guessed as Stopped (techlead, 12 November 2026).
  assert.equal(agentRowState(job({ status: 'failed', failure: null })), 'failed');
  assert.equal(agentRowState(job({ status: 'failed', failure: undefined })), 'failed');
  // An older "Stop waiting": the chat stopped following.
  assert.equal(agentRowState(job({ status: 'cancelled' })), 'unfollowed');

  assert.equal(AGENT_ROW_WORDS.writing, 'Writing');
  assert.equal(AGENT_ROW_WORDS.replied, 'Replied');
  assert.equal(AGENT_ROW_WORDS.stopped, 'Stopped');
  assert.equal(AGENT_ROW_WORDS.failed, 'Couldn’t reply. Lawexa carried on without it');
  // The words are words: no typing dots anywhere.
  for (const words of Object.values(AGENT_ROW_WORDS)) assert.doesNotMatch(words, /…|\.\.\./);
});

test('a row shows the agent’s initials', () => {
  assert.equal(agentInitials('Issue Spotter'), 'IS');
  assert.equal(agentInitials('Expert'), 'EX');
  assert.equal(agentInitials('Lite'), 'LI');
  assert.equal(agentInitials('a fresh Lawexa'), 'LA');
  assert.equal(agentInitials('Contract Drafting Assistant'), 'CD');
  assert.equal(agentInitials('  '), '?');
});

test('a writing agent streams its turn, and Stop shows only to a reader the server lets stop it', () => {
  const [row] = agentRows([job()], [entry()]);
  assert.deepEqual(row, {
    jobId: 'job-1',
    conversationId: SPOTTER_CHAT,
    name: 'Issue Spotter',
    state: 'writing',
    executionId: 'exec-1',
    canStop: true,
    replyStart: null,
  });
  // `can_send` false: the words still stream, Stop does not show.
  const [watcher] = agentRows([job()], [entry({ can_send: false })]);
  assert.equal(watcher.executionId, 'exec-1');
  assert.equal(watcher.canStop, false);
  // The list not read yet, or older than the job: the state alone, no stream, no Stop, and the list is read again.
  for (const list of [undefined, [], [entry({ status: 'idle', execution_id: null, stream_url: null })]]) {
    const [early] = agentRows([job()], list);
    assert.equal(early.state, 'writing');
    assert.equal(early.executionId, null);
    assert.equal(early.canStop, false);
    assert.equal(rosterNeedsList([early]), true);
  }
  assert.equal(rosterNeedsList([row]), false);
});

test('the stream ends with the turn: an ended job never streams or offers Stop, whatever the list still says', () => {
  for (const ended of [
    job({ status: 'succeeded', wake: 'pending' }),
    job({ status: 'failed', failure: 'stopped' }),
    job({ status: 'failed', failure: 'error' }),
    job({ status: 'cancelled' }),
  ]) {
    const [row] = agentRows([ended], [entry()]);
    assert.equal(row.executionId, null, ended.status);
    assert.equal(row.canStop, false, ended.status);
  }
  assert.equal(rosterNeedsList(agentRows([job({ status: 'succeeded' })], undefined)), false);
});

test('a replied row keeps the start of the reply as plain words', () => {
  const replied = job({ status: 'succeeded', wake: 'woken' });
  const preview = '**ISSUES ARISING — TENANT**\n*Assumed framework: Lagos…';
  const [row] = agentRows([replied], [entry({ status: 'idle', execution_id: null, last_reply: { message_id: 9123, preview, created_at: '2026-11-12T09:14:00+00:00' } })]);
  assert.equal(row.state, 'replied');
  assert.equal(row.replyStart, 'ISSUES ARISING — TENANT Assumed framework: Lagos…');
  // A stopped or failed row shows no reply, even when the agent wrote one earlier.
  const [stopped] = agentRows([job({ status: 'failed', failure: 'stopped' })], [entry({ last_reply: { message_id: 1, preview, created_at: '' } })]);
  assert.equal(stopped.replyStart, null);
});

test('two agents at once are two rows, in the jobs’ order; other work is not a row', () => {
  const rows = agentRows(
    [
      job(),
      job({ id: 'job-2', kind: 'file_transcription', kind_name: 'file reading', agent_conversation: null }),
      job({ id: 'job-3', agent_conversation: { id: EXPERT_CHAT, agent: EXPERT } }),
    ],
    [entry(), entry({ id: EXPERT_CHAT, agent: EXPERT, execution_id: 'exec-3', can_send: false })],
  );
  assert.deepEqual(
    rows.map((row) => [row.name, row.state, row.executionId, row.canStop]),
    [
      ['Issue Spotter', 'writing', 'exec-1', true],
      ['Expert', 'writing', 'exec-3', false],
    ],
  );
});

const iso = (minutes: number) => new Date(Date.parse('2026-11-12T09:00:00Z') + minutes * 60_000).toISOString();
const message = (id: number, role: ApiMessage['role'], content: string, metadata: ApiMessage['metadata'] = {}): ApiMessage => ({
  id,
  conversation_id: 'conv-1',
  agent_id: null,
  role,
  content,
  metadata,
  created_at: iso(id),
});

test('the agents’ rows go after the answer of the turn that called them, before Lawexa’s return', () => {
  const rows = transformApiMessages(
    [
      message(1, 'user', 'TEST DATA. Ask Issue Spotter about the lease.'),
      message(2, 'assistant', 'TEST DATA. I’ve asked Issue Spotter.'),
      message(3, 'user', 'Background work you started earlier in this chat has ended: …', {
        type: 'background_job_result',
        background_jobs: [{ job_id: 'job-1', kind: 'agent_reply', outcome: 'succeeded' }],
      }),
      message(4, 'assistant', 'TEST DATA. Issue Spotter found three issues.'),
      message(5, 'user', 'TEST DATA. Thanks.'),
    ],
    { events: true },
  ) as EngineMessage[];
  const groups = groupMessages(rows);
  const places = turnEndPlaces(groups, savedIdOf);
  // Question 1's turn ends at its answer (group 1); question 5's at itself (nothing after it yet).
  assert.deepEqual([...places.entries()], [
    [1, 1],
    [4, 5],
  ]);

  // A question not saved yet has no place: it has no jobs.
  const unsaved = groupMessages([{ ...rows[0], id: 'local-1', savedId: undefined } as EngineMessage]);
  assert.equal(turnEndPlaces(unsaved, () => null).size, 0);

  const list = read('MessageList.tsx');
  assert.match(list, /const turnEnds = useMemo\(\(\) => turnEndPlaces\(groups, savedIdOf\), \[groups\]\);/);
  assert.match(list, /\{turnEnds\.has\(gi\) \? <AgentRoster messageId=\{turnEnds\.get\(gi\) \?\? null\} \/> : null\}/);
});

test('Stop ends the agent’s turn, never just the chat’s waiting; the row streams from the turn’s own stream', () => {
  const roster = read('agents', 'AgentRoster.tsx');
  assert.match(roster, /\{row\.canStop && row\.executionId \? <StopPill name=\{row\.name\} executionId=\{row\.executionId\} \/> : null\}/);
  assert.match(roster, /void chatApi\.cancelStream\(executionId, token\);/);
  assert.doesNotMatch(roster, /cancelBackgroundJob|backgroundJobsApi|\.cancel\(job/);
  // One window per turn, from the reader the side panel uses; its end re-reads the jobs and the list.
  assert.match(roster, /<LiveWindow key=\{row\.executionId\} executionId=\{row\.executionId\} onEnd=\{onTurnEnd\} \/>/);
  assert.match(roster, /const live = useAgentStream\(executionId, onEnd\);/);
  assert.match(roster, /queryKey: conversationsQueries\.backgroundJobsOf\(parentId\)/);
  assert.match(roster, /queryKey: agentConversationQueries\.all\(\)/);
  // The window is held to its foot and fades at the top once full; no dots.
  assert.match(roster, /flex flex-col justify-end overflow-hidden/);
  assert.match(roster, /maskImage: full \? `linear-gradient\(to bottom, transparent, black \$\{LINE_EM\}em\)` : undefined,/);
  assert.doesNotMatch(roster, /is writing|typing|…<|\.\.\.</);
  // Replied reads the reply; stopped and couldn't-reply open the conversation.
  assert.match(roster, /Read the reply/);
  assert.match(roster, /Open its conversation/);

  // The return line no longer carries preview cards: the rows show the replies.
  assert.doesNotMatch(read('rows', 'EventLineRow.tsx'), /AgentReplyRows|agentReplies/);
});

test('the side panel streams the agent’s reply, with Stop in its write box', () => {
  const panel = read('agents', 'AgentConversationPanel.tsx');
  assert.match(panel, /\{running \? <LiveTurn key=\{running\} executionId=\{running\} agentName=\{agentName\} onEnd=\{refresh\} \/> : null\}/);
  assert.match(panel, /aria-label=\{`Stop \$\{conversation\.agent\.name\}`\}/);
  assert.match(panel, /void chatApi\.cancelStream\(running, token\);/);
});
