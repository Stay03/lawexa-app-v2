import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BackgroundJobOutcome } from '@/types/background-jobs';
import { backgroundReturnLine } from '../background-jobs/model';
import { parseSidePanelValue, sidePanelValue } from '../side-panel/side-panel-value';
import { agentNameFromSlug, calledAgentName, messageAgentStep } from './agent-model';

/* Sub-agents in a chat (docs/api/sub-agents-contract.md, sections 3 and 4):
 * Lawexa's step "Writing to X", the return's line, and the agent's
 * conversation beside the chat. The agents' rows are agent-roster.test.ts.
 * TEST DATA only. */

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

test('the return names the agents that answered', () => {
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
});

test('an agent conversation opens in the chat’s side panel by its uuid', () => {
  assert.equal(sidePanelValue({ kind: 'agent', id: CONVERSATION }), `agent:${CONVERSATION}`);
  assert.deepEqual(parseSidePanelValue(`agent:${CONVERSATION}`), { kind: 'agent', id: CONVERSATION });
  assert.deepEqual(parseSidePanelValue(`agent:${CONVERSATION.toUpperCase()}`), { kind: 'agent', id: CONVERSATION });
  for (const bad of ['agent:', 'agent:issue-spotter-1', 'agent:123', 'agent:../x']) assert.equal(parseSidePanelValue(bad), null, bad);

  const read = (...parts: string[]) => readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', ...parts), 'utf8');
  // Each agent's row opens its conversation ("Read the reply", "Open its conversation").
  assert.match(read('agents', 'AgentRoster.tsx'), /const open = panel \? \(\) => panel\.open\(\{ kind: 'agent', id: row\.conversationId \}\) : null;/);
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
