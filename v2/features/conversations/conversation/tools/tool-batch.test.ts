import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import {
  RUN_TOGETHER,
  batchFromParameters,
  batchFromReload,
  batchGoal,
  batchOnCalling,
  batchOnComplete,
  batchOnEnd,
  batchSettled,
  type BatchCall,
} from '@/lib/utils/tool-batch';
import type { ApiMessage, ToolMessage } from '@/types/chat';

/* run_together, the batch tool (Stay, thread 694678cf, 24 November 2026), in
 * Backend's shapes: the goal is the step's line, each lookup a sub-row under
 * it, working, done or failed, live and after a reload. TEST DATA throughout. */

const parameters = {
  goal: 'Finding how courts treat SIM-swap losses',
  calls: [
    { tool: 'search_cases', arguments: { query: 'TEST DATA SIM swap bank liability' } },
    { tool: 'search_notes', arguments: { query: 'TEST DATA SIM swap fraud' } },
    { tool: 'get_note', arguments: { note_id: 1831 } },
    { tool: 'search_statutes', arguments: { query: 'TEST DATA Cybercrimes Act section 22' } },
  ],
};
const ok = (data: unknown = { items: [] }) => ({ success: true, data, error: null });
const failed = { success: false, data: null, error: null };
const states = (batch: readonly BatchCall[]) => batch.map((row) => row.state);

test("the step's line is the goal Lawexa wrote, and the lookups start waiting, in the order asked", () => {
  assert.equal(batchGoal(parameters), 'Finding how courts treat SIM-swap losses');
  assert.equal(batchGoal({ calls: [] }), null);
  const batch = batchFromParameters(parameters);
  assert.deepEqual(batch.map((row) => row.tool), ['search_cases', 'search_notes', 'get_note', 'search_statutes']);
  assert.deepEqual(states(batch), ['waiting', 'waiting', 'waiting', 'waiting']);
  assert.deepEqual(batch[0].arguments, { query: 'TEST DATA SIM swap bank liability' });
});

test('live: four at a time, ending out of order, each lookup lands on its own row by its tool_call_id', () => {
  let batch = batchFromParameters(parameters);
  for (const [place, tool] of [[1, 'search_cases'], [2, 'search_notes'], [3, 'get_note'], [4, 'search_statutes']] as const) {
    batch = batchOnCalling(batch, { callId: `call_b.${place}`, tool });
  }
  assert.deepEqual(states(batch), ['working', 'working', 'working', 'working']);
  // They end 3, 1, 4, 2.
  batch = batchOnComplete(batch, { callId: 'call_b.3', tool: 'get_note', result: ok({ note: { title: 'TEST DATA SIM-swap liability note' } }), latencyMs: 120 });
  assert.deepEqual(states(batch), ['working', 'working', 'done', 'working']);
  batch = batchOnComplete(batch, { callId: 'call_b.1', tool: 'search_cases', result: ok(), latencyMs: 600 });
  batch = batchOnComplete(batch, { callId: 'call_b.4', tool: 'search_statutes', result: ok(), latencyMs: 300 });
  assert.equal(batchSettled(batch), false);
  batch = batchOnComplete(batch, { callId: 'call_b.2', tool: 'search_notes', result: ok(), latencyMs: 900 });
  assert.deepEqual(states(batch), ['done', 'done', 'done', 'done']);
  assert.equal(batch[2].latencyMs, 120);
  assert.equal(batchSettled(batch), true);
});

test('a completion that arrives before its start still finds its row', () => {
  const batch = batchOnComplete(batchFromParameters(parameters), { callId: 'call_b.2', tool: 'search_notes', result: ok() });
  assert.deepEqual(states(batch), ['waiting', 'done', 'waiting', 'waiting']);
});

test('a failed lookup reads failed, and the others go on', () => {
  let batch = batchFromParameters(parameters);
  batch = batchOnCalling(batch, { callId: 'call_b.1', tool: 'search_cases' });
  batch = batchOnComplete(batch, { callId: 'call_b.1', tool: 'search_cases', result: failed });
  assert.deepEqual(states(batch), ['failed', 'waiting', 'waiting', 'waiting']);
  // The end settles every row from its results, in input order (a lookup whose events were missed too).
  batch = batchOnEnd(batch, {
    goal: parameters.goal,
    done: 3,
    failed: 1,
    results: [
      { i: 0, tool: 'search_cases', success: false, error: null },
      { i: 1, tool: 'search_notes', success: true },
      { i: 2, tool: 'get_note', success: true },
      { i: 3, tool: 'search_statutes', success: true },
    ],
  });
  assert.deepEqual(states(batch), ['failed', 'done', 'done', 'done']);
});

test('after a reload: the same rows from the saved call and batch_calls, with the note a read lookup opened', () => {
  const at = '2026-11-24T06:10:00+00:00';
  const saved: ApiMessage[] = [
    {
      id: 700001, conversation_id: 'TEST-chat', agent_id: 1, role: 'assistant', content: '', created_at: at,
      metadata: { type: 'tool_call', iteration: 1, tool_call_id: 'call_b', tool_name: RUN_TOGETHER, tool_parameters: parameters },
    } as ApiMessage,
    {
      id: 700002, conversation_id: 'TEST-chat', agent_id: 1, role: 'tool', created_at: at,
      content: JSON.stringify({ success: true, data: { goal: parameters.goal, done: 3, failed: 1, results: [] }, error: null }),
      metadata: {
        type: 'tool_result', iteration: 1, tool_call_id: 'call_b', tool_name: RUN_TOGETHER,
        batch_calls: [
          { i: 0, tool: 'search_cases', success: true },
          { i: 1, tool: 'search_notes', success: false },
          { i: 2, tool: 'get_note', success: true, note_title: 'TEST DATA SIM-swap liability note' },
          { i: 3, tool: 'search_statutes', success: true },
        ],
      },
    } as ApiMessage,
  ];
  const [step] = transformApiMessages(saved).filter((message) => message.role === 'tool') as ToolMessage[];
  assert.equal(step.toolName, RUN_TOGETHER);
  assert.equal(step.toolStatus, 'complete');
  assert.deepEqual(states(step.batch!), ['done', 'failed', 'done', 'done']);
  assert.equal(step.batch![2].entityTitle, 'TEST DATA SIM-swap liability note');
  // Saved without batch_calls (an older server): the lookups still show, as ended.
  assert.deepEqual(states(batchFromReload(parameters, undefined)), ['done', 'done', 'done', 'done']);
});

test('the chat listens for the batch events and draws the sub-rows under the goal line; a single step is unchanged', () => {
  const engine = readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');
  assert.match(engine, /es\.addEventListener\('tool_batch_calling'[\s\S]*?updateBatch\(event\.parent_tool_call_id, \(batch\) => batchOnCalling\(/);
  assert.match(engine, /es\.addEventListener\('tool_batch_complete'[\s\S]*?updateBatch\(event\.parent_tool_call_id, \(batch\) =>\s*batchOnComplete\(/);
  assert.match(engine, /if \(event\.tool_call\.name === RUN_TOGETHER && event\.tool_call_id\) batches\.set\(event\.tool_call_id, msgId\);/);
  const item = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx'), 'utf8');
  assert.match(item, /case RUN_TOGETHER:\s*return \{ action: batchGoal\(parameters\)/);
  assert.match(item, /\{batch \? <BatchRows calls=\{batch\} \/> : null\}/);
});
