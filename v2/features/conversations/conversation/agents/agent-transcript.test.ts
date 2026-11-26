import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage } from '@/types/chat';
import { agentConversationTopic, agentTranscriptRows, subAgentPlaces, subAgentReplyView } from './agent-transcript';

/* An agent conversation in the side panel (sub-agents contract, 3.2, "How to
 * read the rows"). TEST DATA only. */

let next = 1;
const row = (patch: Partial<ApiMessage>): ApiMessage =>
  ({
    id: next++,
    conversation_id: '7e1a0000-0000-4000-8000-000000000001',
    agent_id: 231,
    role: 'assistant',
    content: '',
    metadata: {},
    created_at: '2026-11-12T09:12:03+00:00',
    ...patch,
  }) as ApiMessage;

test('the call reads "From Expert", a typed turn is the person’s, the answer is the agent’s', () => {
  const rows = agentTranscriptRows([
    row({
      role: 'user',
      content: 'TEST DATA Spot the issues in these facts.',
      metadata: { type: 'agent_message', from_agent: { id: 229, slug: 'expert', name: 'Expert' } },
    }),
    row({ role: 'assistant', content: 'Let me look.', metadata: { type: 'narration' } }),
    row({ role: 'assistant', content: '', metadata: { type: 'tool_call', tool_name: 'search_cases', tool_parameters: { query: 'notice' } } }),
    row({ role: 'tool', content: '{}', metadata: { type: 'tool_result', tool_name: 'search_cases', success: true } }),
    row({ role: 'assistant', content: '', metadata: { type: 'tool_call', tool_name: 'read_file', tool_parameters: { file_id: 512 }, success: false } }),
    row({ role: 'assistant', content: 'Three issues arise.', metadata: {} }),
    row({ role: 'user', content: 'TEST DATA Also check the notice period.', metadata: {}, author: { id: 51, uuid: 'u', name: 'Ada' } as ApiMessage['author'] }),
    row({ role: 'user', content: 'Background work …', metadata: { type: 'background_job_result', background_jobs: [] } }),
  ]);
  assert.deepEqual(
    rows.map((each) => each.kind),
    ['call', 'answer', 'steps', 'answer', 'person', 'note'],
  );
  assert.equal(rows[0].kind === 'call' && rows[0].from, 'Expert');
  // Tool calls in a row are one list; results are left out.
  assert.deepEqual(rows[2].kind === 'steps' && rows[2].calls.map((call) => [call.name, call.success]), [
    ['search_cases', undefined],
    ['read_file', false],
  ]);
  assert.equal(rows[4].kind === 'person' && rows[4].author, 'Ada');
  // The return the agent's own sub-agent woke it with is a note, never its content (written for the model).
  assert.equal(rows[5].kind === 'note' && rows[5].text, 'Background work this agent started has ended.');
});

test('a file’s marks are taken out of a turn; an empty answer is left out', () => {
  const rows = agentTranscriptRows([
    row({
      role: 'user',
      content: '<attached_document name="Document 1">long text</attached_document>\nRead this.',
      metadata: { type: 'agent_message', from_agent: { id: 1, slug: 'lite', name: 'Lite' } },
      attachments: [{ file_id: 9, file_name: 'Document 1', file_size: 10 }],
    }),
    row({ role: 'assistant', content: '   ', metadata: {} }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind === 'call' && rows[0].text, 'Read this.');
});

test('the title drops the agent’s name the server puts first', () => {
  assert.equal(agentConversationTopic('Issue Spotter: Spot the issues in the lease dispute', 'Issue Spotter'), 'Spot the issues in the lease dispute');
  assert.equal(agentConversationTopic('Lease review', 'Issue Spotter'), 'Lease review');
  assert.equal(agentConversationTopic('Expert: x', null), 'Expert: x');
});

test('the panel watches the running turn, posts to the agent conversation route, and opens from ?side=agent', () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
  const here = (...parts: string[]) => read('v2', 'features', 'conversations', 'conversation', ...parts);
  assert.match(here('side-panel', 'SidePanelSlot.tsx'), /case 'agent':\s*return <AgentConversationPanel key=\{target\.id\} conversationId=\{target\.id\} \/>;/);
  const panel = here('agents', 'AgentConversationPanel.tsx');
  assert.match(panel, /\{running \? <LiveTurn key=\{running\} executionId=\{running\}/);
  assert.match(panel, /footer=\{entry\?\.can_send \? <AgentComposer/);
  assert.match(panel, /mutationFn: \(message: string\) => agentConversationsApi\.send\(conversation\.id, message\)/);
  // The turn is watched with the login in a header, never in the address.
  const stream = here('agents', 'use-agent-stream.ts');
  assert.match(stream, /new AuthedEventSource\(`\$\{API_BASE_URL\}\/api\/chat\/stream\/\$\{executionId\}`/);
  assert.doesNotMatch(stream, /token=/);
  // A typed message goes to its own route, never POST /api/chat.
  assert.match(read('lib', 'api', 'agent-conversations.ts'), /apiClient\.post<AgentConversationSendResponse>\(`\/agent-conversations\/\$\{agentConversationUuid\}\/messages`/);
});

// Depth 2 (24 November 2026): Expert > Issue Spotter (TEST) > Law Checker, shaped as the live test chat 8ef5ef02.
const lawChecker = { id: 233, name: 'Law Checker', slug: 'law-checker' };
const checkerConversation = '893ed646-6712-4431-ada0-bb5dad39f55b';
type Job = NonNullable<NonNullable<ApiMessage['metadata']>['background_jobs']>[number];
const agentJob = (outcome: 'succeeded' | 'failed' | 'cancelled', over: Partial<Job> = {}): Job => ({
  job_id: `TEST-job-${outcome}`,
  kind: 'agent_reply',
  outcome,
  agent_reply: {
    agent_conversation_id: checkerConversation,
    agent: lawChecker,
    reply_message_id: outcome === 'succeeded' ? 640787 : null,
    preview: outcome === 'succeeded' ? '**THE ISSUE LIST, CHECKED** 1. TEST DATA unlawful processing.' : null,
  },
  ...over,
});
const wake = (jobs: Job[], id = 640788) =>
  row({ id, role: 'user', content: 'Background work you started earlier in this chat has ended: TEST DATA (written for Lawexa, never shown)', metadata: { type: 'background_job_result', background_jobs: jobs } });
const spotterTurn = [
  row({ id: 640688, role: 'user', content: 'TEST DATA. Please analyse the following problem.', metadata: { type: 'agent_message', from_agent: { id: 235, name: 'Expert (TEST)', slug: 'expert-test' } } }),
  row({ id: 640713, role: 'assistant', content: "I need to wrap up. I'll send my report to the Law Checker now." }),
  row({ id: 640715, role: 'assistant', content: '', metadata: { type: 'tool_call', tool_name: 'message_agent', tool_parameters: { agent: 'law-checker', message: 'TEST DATA' } } }),
  row({ id: 640716, role: 'tool', content: '', metadata: { type: 'tool_result', tool_name: 'message_agent' } }),
  row({ id: 640717, role: 'assistant', content: "I've asked Law Checker; I'll answer when it replies." }),
];
const finalAnswer = row({ id: 640789, role: 'assistant', content: '**Law checked** TEST DATA.' });

test("the agent's own sub-agent coming back reads as that agent replying, with its reply's start and its conversation", () => {
  const rows = agentTranscriptRows([...spotterTurn, wake([agentJob('succeeded')]), finalAnswer]);
  const reply = rows.find((each) => each.kind === 'reply');
  assert.ok(reply && reply.kind === 'reply');
  assert.deepEqual(subAgentReplyView(reply, new Set()), {
    heading: 'Law Checker replied',
    outcome: 'replied',
    preview: '**THE ISSUE LIST, CHECKED** 1. TEST DATA unlawful processing.',
    openId: checkerConversation,
  });
  // The wake's own words, written for Lawexa, are never shown, and no other line is added.
  assert.ok(!rows.some((each) => 'text' in each && each.text.includes('written for Lawexa')));
  assert.equal(rows.filter((each) => each.kind === 'note').length, 0);
});

test('a sub-agent that could not reply, or that a person stopped, says so, with no preview, and can still be opened', () => {
  const failed = agentTranscriptRows([...spotterTurn, wake([agentJob('failed')])]).find((each) => each.kind === 'reply');
  assert.ok(failed && failed.kind === 'reply');
  assert.deepEqual(subAgentReplyView(failed, new Set()), { heading: 'Law Checker could not reply', outcome: 'failed', preview: null, openId: checkerConversation });
  // A Stop: today the wake names it "cancelled"; a failure the server names "stopped" reads the same.
  for (const job of [agentJob('cancelled'), agentJob('failed', { failure: 'stopped' })]) {
    const stopped = agentTranscriptRows([...spotterTurn, wake([job])]).find((each) => each.kind === 'reply');
    assert.ok(stopped && stopped.kind === 'reply');
    assert.equal(subAgentReplyView(stopped, new Set()).heading, 'Law Checker was stopped');
  }
});

test('a partial reply entry (no agent, no conversation) is left out, never opened as undefined', () => {
  const full = agentJob('succeeded').agent_reply!;
  const noConversation = agentJob('succeeded', { agent_reply: { ...full, agent_conversation_id: '' } });
  const noAgent = agentJob('succeeded', { agent_reply: { ...full, agent: null as unknown as typeof lawChecker } });
  const rows = agentTranscriptRows([...spotterTurn, wake([noConversation, noAgent])]);
  assert.equal(rows.filter((each) => each.kind === 'reply').length, 0);
});

test("a wake with a sub-agent's reply and other background work keeps both: the reply line and the other work's line", () => {
  const file: Job = { job_id: 'TEST-job-file', kind: 'file_transcription', outcome: 'succeeded' };
  const rows = agentTranscriptRows([...spotterTurn, wake([agentJob('succeeded'), file])]);
  assert.deepEqual(rows.slice(-2).map((each) => each.kind), ['reply', 'note']);
});

test("the start of a reply is shown once: not under a roster row showing that same reply, but kept for an earlier call's reply", () => {
  const reply = agentTranscriptRows([...spotterTurn, wake([agentJob('succeeded')])]).find((each) => each.kind === 'reply');
  assert.ok(reply && reply.kind === 'reply');
  assert.equal(subAgentReplyView(reply, new Set([640787])).preview, null);
  // The roster now shows a later call's reply (640900): this earlier line keeps its own start.
  assert.ok(subAgentReplyView(reply, new Set([640900])).preview);
});

test("the agent's own sub-agents are drawn at the end of the turn that called them, before their return", () => {
  // Mid-chain: the Law Checker is still working, so the turn ends at "I've asked".
  const mid = agentTranscriptRows(spotterTurn);
  assert.deepEqual([...subAgentPlaces(mid)], [[mid.length - 1, 640688]]);
  // After: the rows go just before the Law Checker's reply.
  const after = agentTranscriptRows([...spotterTurn, wake([agentJob('succeeded')]), finalAnswer]);
  const replyAt = after.findIndex((each) => each.kind === 'reply');
  assert.equal(subAgentPlaces(after).get(replyAt - 1), 640688);
});

test("a call made from the turn a wake starts gets its rows too, at the end of that turn, under the wake's id", () => {
  // The woken Issue Spotter asks the Law Checker again: the server names the wake (640788) as that call's message.
  const again = [
    row({ id: 640790, role: 'assistant', content: '', metadata: { type: 'tool_call', tool_name: 'message_agent', tool_parameters: { agent: 'law-checker', message: 'TEST DATA' } } }),
    row({ id: 640791, role: 'assistant', content: "I've asked Law Checker again; I'll answer when it replies." }),
  ];
  const rows = agentTranscriptRows([...spotterTurn, wake([agentJob('succeeded')]), ...again]);
  const places = [...subAgentPlaces(rows)];
  assert.deepEqual(places.map(([, id]) => id), [640688, 640788]);
  assert.equal(places[1][0], rows.length - 1);
  // Two replies in one wake do not split the woken turn.
  const two = agentTranscriptRows([...spotterTurn, wake([agentJob('succeeded'), agentJob('succeeded', { job_id: 'TEST-job-2' })]), ...again]);
  assert.deepEqual([...subAgentPlaces(two)].map(([, id]) => id), [640688, 640788]);
});

test("the panel draws its own sub-agents with the chat's roster, named for the agent, and their return with Open", () => {
  const dir = join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'agents');
  const source = readFileSync(join(dir, 'AgentConversationPanel.tsx'), 'utf8');
  // Read through the panel's source: the owner's routes, or the admin view's snapshot (agent-panel-source.ts).
  assert.match(source, /source\.agents\(\{ parentId: conversationId, viewerId \}\)/);
  assert.match(source, /places\.has\(index\) \? <AgentRoster messageId=\{places\.get\(index\) \?\? null\} askedBy=\{agentName \?\? 'This agent'\} \/>/);
  assert.match(source, /subAgentReplyView\(row, useRosterReplyIds\(\)\)[\s\S]*?panel\.open\(\{ kind: 'agent', id: view\.openId \}\)[\s\S]*?Open its conversation/);
  const roster = readFileSync(join(dir, 'AgentRoster.tsx'), 'utf8');
  assert.match(roster, /aria-label=\{`Agents \$\{askedBy\} asked`\}/);
});
