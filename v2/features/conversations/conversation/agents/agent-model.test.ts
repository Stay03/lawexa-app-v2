import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BackgroundJob, BackgroundJobOutcome } from '@/types/background-jobs';
import { backgroundJobLabel, backgroundReturnLine } from '../background-jobs/model';
import { parseSidePanelValue, sidePanelValue } from '../side-panel/side-panel-value';
import {
  agentJobLabel,
  agentNameFromSlug,
  agentReplies,
  agentReplyText,
  calledAgentName,
  jobAgentConversation,
  messageAgentStep,
} from './agent-model';

/* Sub-agents in a chat (docs/api/sub-agents-contract.md, sections 3 and 4):
 * "Writing to X…", "Waiting for X…", and X's reply with "Open full". TEST DATA
 * only. */

const SPOTTER = { id: 231, name: 'Issue Spotter', slug: 'issue-spotter' };
const EXPERT = { id: 229, name: 'Expert', slug: 'expert' };
const CONVERSATION = '7e1a0000-0000-4000-8000-000000000001';
const OTHER = '8f2b0000-0000-4000-8000-000000000002';

test('the call reads "Writing to Issue Spotter" from the slug, then by the name the tool answers with', () => {
  assert.equal(agentNameFromSlug('issue-spotter'), 'Issue Spotter');
  assert.equal(agentNameFromSlug('lawexa'), 'a fresh Lawexa');
  assert.equal(agentNameFromSlug('LAWEXA'), 'a fresh Lawexa');
  assert.equal(agentNameFromSlug('  '), 'another agent');
  assert.deepEqual(messageAgentStep({ agent: 'issue-spotter', message: 'TEST DATA' }, false), { action: 'Writing to Issue Spotter' });
  const answered = { data: { agent_conversation: { handle: 'issue-spotter-1', agent: SPOTTER, is_new: true, depth: 1 } } };
  assert.equal(calledAgentName(answered), 'Issue Spotter');
  assert.deepEqual(messageAgentStep({ agent: 'issue-spotter' }, true, answered), { action: 'Wrote to Issue Spotter' });
  // A continued conversation names no slug; the answer still names the agent.
  assert.deepEqual(messageAgentStep({ agent_conversation: 'issue-spotter-1' }, true, answered), { action: 'Wrote to Issue Spotter' });
  assert.deepEqual(messageAgentStep({}, false), { action: 'Writing to another agent' });
  // The handle the model uses is never shown.
  assert.doesNotMatch(JSON.stringify(messageAgentStep({ agent: 'issue-spotter' }, true, answered)), /issue-spotter-1/);
  // The transcript's step uses it.
  const step = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx'), 'utf8');
  assert.match(step, /case MESSAGE_AGENT_TOOL:\s*return messageAgentStep\(parameters, isComplete, toolResult\);/);
});

const job = (patch: Partial<BackgroundJob>): BackgroundJob => ({
  id: 'job-1',
  kind: 'agent_reply',
  kind_name: 'message to another agent',
  status: 'running',
  progress: null,
  started_at: '2026-11-12T09:12:03+00:00',
  finished_at: null,
  started_by_message_id: 81234,
  wake: null,
  agent_conversation: { id: CONVERSATION, agent: SPOTTER },
  ...patch,
});

test('the waiting line names the agent, through every state of its job', () => {
  assert.equal(backgroundJobLabel(job({})), 'Waiting for Issue Spotter…');
  assert.equal(backgroundJobLabel(job({ status: 'succeeded', wake: 'pending' })), 'Issue Spotter replied. Lawexa will reply shortly.');
  assert.equal(backgroundJobLabel(job({ status: 'failed', wake: 'pending' })), 'Issue Spotter could not reply. Lawexa will reply shortly.');
  assert.equal(backgroundJobLabel(job({ status: 'succeeded', wake: 'woken' })), 'Issue Spotter replied');
  assert.equal(backgroundJobLabel(job({ status: 'failed', wake: 'woken' })), 'Issue Spotter could not reply');
  assert.equal(backgroundJobLabel(job({ status: 'cancelled' })), 'Stopped waiting for Issue Spotter');
  assert.equal(agentJobLabel('Expert', 'unanswered', true), 'Expert could not reply');
  // Other kinds read as before.
  assert.equal(
    backgroundJobLabel(job({ kind: 'file_transcription', kind_name: 'file reading', agent_conversation: null })),
    'Running in the background: file reading',
  );
  assert.deepEqual(jobAgentConversation(job({})), { id: CONVERSATION, agent: SPOTTER });
  assert.equal(jobAgentConversation(job({ kind: 'radar_scan', agent_conversation: { id: CONVERSATION, agent: SPOTTER } })), null);
});

test('the return names the agents that answered, and each gets a preview row', () => {
  const outcomes: BackgroundJobOutcome[] = [
    {
      job_id: '4b0c',
      kind: 'agent_reply',
      outcome: 'succeeded',
      agent_reply: { agent_conversation_id: CONVERSATION, agent: SPOTTER, reply_message_id: 9123, preview: 'Three issues arise from these facts.' },
    },
    {
      job_id: '9d2e',
      kind: 'agent_reply',
      outcome: 'failed',
      agent_reply: { agent_conversation_id: OTHER, agent: EXPERT, reply_message_id: null, preview: null },
    },
  ];
  assert.equal(backgroundReturnLine(outcomes.slice(0, 1)), 'Issue Spotter replied. Lawexa is continuing.');
  assert.equal(backgroundReturnLine(outcomes.slice(1)), 'Expert could not reply. Lawexa is continuing.');
  assert.equal(backgroundReturnLine(outcomes), '2 background jobs ended. Lawexa is continuing.');
  const replies = agentReplies([...outcomes, { job_id: 'x', kind: 'file_transcription', outcome: 'succeeded' }]);
  assert.deepEqual(
    replies.map((reply) => [reply.agent.name, reply.agent_conversation_id, reply.failed, agentReplyText(reply)]),
    [
      ['Issue Spotter', CONVERSATION, false, 'Three issues arise from these facts.'],
      ['Expert', OTHER, true, 'Expert could not reply.'],
    ],
  );
});

test('an agent conversation opens in the chat’s side panel by its uuid', () => {
  assert.equal(sidePanelValue({ kind: 'agent', id: CONVERSATION }), `agent:${CONVERSATION}`);
  assert.deepEqual(parseSidePanelValue(`agent:${CONVERSATION}`), { kind: 'agent', id: CONVERSATION });
  assert.deepEqual(parseSidePanelValue(`agent:${CONVERSATION.toUpperCase()}`), { kind: 'agent', id: CONVERSATION });
  for (const bad of ['agent:', 'agent:issue-spotter-1', 'agent:123', 'agent:../x']) assert.equal(parseSidePanelValue(bad), null, bad);

  const read = (...parts: string[]) => readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', ...parts), 'utf8');
  assert.match(read('background-jobs', 'BackgroundJobsLabel.tsx'), /onClick=\{\(\) => panel\.open\(\{ kind: 'agent', id: agentConversation\.id \}\)\}/);
  assert.match(read('agents', 'AgentReplyRows.tsx'), /onClick=\{\(\) => panel\.open\(\{ kind: 'agent', id: reply\.agent_conversation_id \}\)\}/);
  assert.match(read('rows', 'EventLineRow.tsx'), /const replies = returned \? agentReplies\(line\.jobs\) : \[\];/);
});

// Review finding 1 (12 November 2026): in a Space, the root chat's owner and
// editors may Stop an agent turn another member's call started. The panel
// takes that from the server's answer alone, never from who opened it.
test("the agent panel's write box and Stop follow the server's can_send, never a check on the viewer", () => {
  const panel = readFileSync(
    join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'agents', 'AgentConversationPanel.tsx'),
    'utf8',
  );
  assert.match(panel, /footer=\{entry\?\.can_send \? <AgentComposer /);
  assert.match(panel, /\{running \? \(\s*<button\s+type="button"\s+onClick=\{stop\}/);
  assert.doesNotMatch(panel, /viewerId\s*[!=]==|[!=]==\s*viewerId|user_id|started_by/);
  assert.doesNotMatch(readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'background-jobs', 'model.ts'), 'utf8'), /user_id|viewerId/);
});

test("a reply row shows the start of the agent's reply as plain words, never its markdown marks", () => {
  const reply = { agent: { name: 'Issue Spotter' }, failed: false, preview: '**ISSUES ARISING — TENANT**\n*Assumed framework: Lagos…' };
  assert.equal(agentReplyText(reply), 'ISSUES ARISING — TENANT Assumed framework: Lagos…');
  assert.equal(agentReplyText({ ...reply, preview: null }), 'Issue Spotter could not reply.');
  assert.equal(agentReplyText({ ...reply, failed: true }), 'Issue Spotter could not reply.');
});
