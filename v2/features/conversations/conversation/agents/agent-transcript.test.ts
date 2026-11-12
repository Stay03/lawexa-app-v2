import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage } from '@/types/chat';
import { agentConversationTopic, agentTranscriptRows } from './agent-transcript';

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
