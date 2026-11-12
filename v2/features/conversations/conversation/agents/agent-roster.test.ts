import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentConversation, AgentLatestCall } from '@/types/agent-conversations';
import type { ApiMessage } from '@/types/chat';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { EngineMessage } from '@/v2/runtime/chat-engine/types';
import { groupMessages, turnEndPlaces } from '../message-groups';
import { savedIdOf } from '../reply-target';
import {
  AGENT_ROW_WORDS,
  agentInitials,
  agentRow,
  agentRowState,
  agentRowsByMessage,
  agentsWorking,
  liveWindowText,
} from './agent-roster';

/* C1 (Stay, 12 November 2026, 17:47Z): each agent Lawexa messaged is a row
 * after the turn that called it, for every reader of the chat, with its
 * state, its own Stop while it works, and its words streaming in. The rows
 * come from the chat's list of agent conversations and each entry's
 * `latest_call` (Backend, 12 November 2026). TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const here = (...parts: string[]) => read('v2', 'features', 'conversations', 'conversation', ...parts);

const SPOTTER = { id: 231, name: 'Issue Spotter', slug: 'issue-spotter' };
const EXPERT = { id: 229, name: 'Expert', slug: 'expert' };
const SPOTTER_CHAT = '7e1a0000-0000-4000-8000-000000000001';
const EXPERT_CHAT = '8f2b0000-0000-4000-8000-000000000002';

const PREVIEW = '**ISSUES ARISING — TENANT**\n*Assumed framework: Lagos…';
const REPLY = { message_id: 9123, preview: PREVIEW, created_at: '2026-11-12T09:14:00+00:00' };

const call = (patch: Partial<AgentLatestCall> = {}): AgentLatestCall => ({
  state: 'working',
  failure: null,
  called_by_message_id: 81240,
  called_at: '2026-11-12T09:12:03+00:00',
  reply: null,
  ...patch,
});

type Called = AgentConversation & { latest_call: AgentLatestCall };

const entry = (patch: Partial<AgentConversation> = {}, latest: Partial<AgentLatestCall> = {}): Called => ({
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
  latest_call: call(latest),
  ...patch,
} as Called);

/** Its turn ended: the entry is idle. */
const IDLE = { status: 'idle', execution_id: null, stream_url: null } as const;

test('an agent row reads Writing, Replied, Stopped or Couldn’t reply from its newest call', () => {
  assert.equal(agentRowState(call()), 'writing');
  assert.equal(agentRowState(call({ state: 'replied' })), 'replied');
  assert.equal(agentRowState(call({ state: 'failed', failure: 'stopped' })), 'stopped');
  for (const failure of ['no_reply', 'error', 'gone', 'wake_abandoned', 'stalled'] as const) {
    assert.equal(agentRowState(call({ state: 'failed', failure })), 'failed', failure);
  }
  // No reason sent: never guessed as Stopped (techlead, 12 November 2026).
  assert.equal(agentRowState(call({ state: 'failed', failure: null })), 'failed');
  // An older "Stop waiting": the chat stopped following.
  assert.equal(agentRowState(call({ state: 'cancelled' })), 'unfollowed');

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
  assert.deepEqual(agentRow(entry()), {
    conversationId: SPOTTER_CHAT,
    name: 'Issue Spotter',
    state: 'writing',
    executionId: 'exec-1',
    canStop: true,
    replyStart: null,
  });
  // `can_send` false (a Space Viewer, a member the server does not let stop it): the words still stream, Stop does not show.
  const watcher = agentRow(entry({ can_send: false }));
  assert.equal(watcher.executionId, 'exec-1');
  assert.equal(watcher.canStop, false);
  // Working, but its turn not running (between two reads): the state alone, no stream, no Stop.
  const between = agentRow(entry(IDLE));
  assert.equal(between.state, 'writing');
  assert.equal(between.executionId, null);
  assert.equal(between.canStop, false);
});

test('the stream ends with the call: an ended call never streams or offers Stop, whatever the turn still says', () => {
  for (const ended of [
    { state: 'replied', reply: REPLY },
    { state: 'failed', failure: 'stopped' },
    { state: 'failed', failure: 'error' },
    { state: 'cancelled' },
  ] as const) {
    const row = agentRow(entry({}, ended));
    assert.equal(row.executionId, null, ended.state);
    assert.equal(row.canStop, false, ended.state);
  }
});

test('a replied row keeps the start of this call’s reply as plain words; a stopped one shows none', () => {
  const row = agentRow(entry(IDLE, { state: 'replied', reply: REPLY }));
  assert.equal(row.state, 'replied');
  assert.equal(row.replyStart, 'ISSUES ARISING — TENANT Assumed framework: Lagos…');
  // Never an earlier call's reply (`last_reply`): a stopped call shows none.
  const stopped = agentRow(entry({ ...IDLE, last_reply: REPLY }, { state: 'failed', failure: 'stopped' }));
  assert.equal(stopped.replyStart, null);
  assert.equal(agentRow(entry({ ...IDLE, last_reply: REPLY }, { state: 'replied', reply: null })).replyStart, null);
});

test('two agents at once are two rows after the turn that called them, in the list’s order', () => {
  const byMessage = agentRowsByMessage([
    entry(),
    entry({ id: EXPERT_CHAT, agent: EXPERT, execution_id: 'exec-3', can_send: false }),
    // Called again in a later turn: the row moves to that turn, not the first call's.
    entry({ id: 'again', ...IDLE }, { state: 'replied', reply: REPLY, called_by_message_id: 81300 }),
    // Its calling message deleted, or never called: no turn to sit after.
    entry({ id: 'orphan' }, { called_by_message_id: null }),
    { ...entry({ id: 'uncalled', ...IDLE }), latest_call: null },
  ]);
  assert.deepEqual([...byMessage.keys()], [81240, 81300]);
  assert.deepEqual(
    byMessage.get(81240)?.map((row) => [row.name, row.state, row.executionId, row.canStop]),
    [
      ['Issue Spotter', 'writing', 'exec-1', true],
      ['Expert', 'writing', 'exec-3', false],
    ],
  );
});

test('the live window shows the words, never a tool call the model writes as text', () => {
  // The C1 stack pictures (12 November 2026): Expert's window showed "<tool" as its next step began.
  assert.equal(liveWindowText('I will look around this Space first. <tool'), 'I will look around this Space first.');
  assert.equal(liveWindowText('Looking now. <tool_call>{"name": "list_space"}</tool_call> and more'), 'Looking now.');
  assert.equal(liveWindowText('**Issue 1.** The notice <'), 'Issue 1. The notice');
  // A comparison sign in the words stays.
  assert.equal(liveWindowText('Rent < 2 years is periodic'), 'Rent < 2 years is periodic');
  assert.match(here('agents', 'AgentRoster.tsx'), /const text = live\.text \? liveWindowText\(live\.text\) : '';/);
});

test('the list is read again on a beat only while an agent works, for a reader who did not ask', () => {
  assert.equal(agentsWorking([entry()]), true);
  assert.equal(agentsWorking([entry(IDLE, { state: 'replied', reply: REPLY }), { latest_call: null }]), false);
  assert.equal(agentsWorking([]), false);
  const queries = here('agents', 'queries.ts');
  assert.match(queries, /!stopsPolling\(query\.state\.error\) && agentsWorking\(query\.state\.data \?\? \[\]\) \? BACKGROUND_JOBS_POLL_MS : false,/);
  // A notification about the chat re-reads its agents too.
  const spine = read('v2', 'runtime', 'realtime', 'spine.tsx');
  assert.match(spine, /queryKey: \[\.\.\.agentConversationQueries\.all\(\), conversationId\]/);
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

  // A question not saved yet has no place: no agent was called from it.
  const unsaved = groupMessages([{ ...rows[0], id: 'local-1', savedId: undefined } as EngineMessage]);
  assert.equal(turnEndPlaces(unsaved, () => null).size, 0);

  const list = here('MessageList.tsx');
  assert.match(list, /const turnEnds = useMemo\(\(\) => turnEndPlaces\(groups, savedIdOf\), \[groups\]\);/);
  assert.match(list, /\{turnEnds\.has\(gi\) \? <AgentRoster messageId=\{turnEnds\.get\(gi\) \?\? null\} \/> : null\}/);
});

test('every reader of the chat sees the rows: they come from the chat’s list, never the reader’s own jobs', () => {
  const roster = here('agents', 'AgentRoster.tsx');
  assert.match(roster, /const held = useAgentRowsOf\(messageId\);/);
  assert.doesNotMatch(roster, /useBackgroundJobsOf|background_jobs/);
  const controller = here('useConversationController.ts');
  assert.match(controller, /const readsAgentConversations = detailData !== null && !isConfidential && !isGoneOnServer;/);
  assert.match(
    controller,
    /if \(ended && readsAgentConversations && !agentConversationsRefused\) \{\s*void queryClient\.invalidateQueries\(\{ queryKey: \[\.\.\.agentConversationQueries\.all\(\), conversationId\] \}\);/,
  );
  assert.match(here('ConversationScreen.tsx'), /<AgentRowsProvider conversationId=\{conversationId\} agentConversations=\{controller\.agentConversations\}>/);
});

test('Stop ends the agent’s turn, never just the chat’s waiting; the row streams from the turn’s own stream', () => {
  const roster = here('agents', 'AgentRoster.tsx');
  assert.match(roster, /\{row\.canStop && row\.executionId \? <StopPill name=\{row\.name\} executionId=\{row\.executionId\} \/> : null\}/);
  assert.match(roster, /void chatApi\.cancelStream\(executionId, token\);/);
  assert.doesNotMatch(roster, /cancelBackgroundJob|backgroundJobsApi|\.cancel\(job/);
  // One window per turn, from the reader the side panel uses; its end re-reads the list and the jobs.
  assert.match(roster, /<LiveWindow key=\{row\.executionId\} executionId=\{row\.executionId\} onEnd=\{onTurnEnd\} \/>/);
  assert.match(roster, /const live = useAgentStream\(executionId, onEnd\);/);
  assert.match(roster, /queryKey: \[\.\.\.agentConversationQueries\.all\(\), parentId\]/);
  assert.match(roster, /queryKey: conversationsQueries\.backgroundJobsOf\(parentId\)/);
  // The window is held to its foot and fades at the top once full; no dots.
  assert.match(roster, /flex flex-col justify-end overflow-hidden/);
  assert.match(roster, /maskImage: full \? `linear-gradient\(to bottom, transparent, black \$\{LINE_EM\}em\)` : undefined,/);
  assert.doesNotMatch(roster, /is writing|typing|…<|\.\.\.</);
  // Replied reads the reply; stopped and couldn't-reply open the conversation.
  assert.match(roster, /Read the reply/);
  assert.match(roster, /Open its conversation/);

  // The return line no longer carries preview cards: the rows show the replies.
  assert.doesNotMatch(here('rows', 'EventLineRow.tsx'), /AgentReplyRows|agentReplies/);
});

test('the side panel streams the agent’s reply, with Stop in its write box', () => {
  const panel = here('agents', 'AgentConversationPanel.tsx');
  assert.match(panel, /\{running \? <LiveTurn key=\{running\} executionId=\{running\} agentName=\{agentName\} onEnd=\{refresh\} \/> : null\}/);
  assert.match(panel, /aria-label=\{`Stop \$\{conversation\.agent\.name\}`\}/);
  assert.match(panel, /void chatApi\.cancelStream\(running, token\);/);
});
