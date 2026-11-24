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
  batchOnFollow,
  batchOnHalt,
  batchSettled,
  type BatchCall,
} from '@/lib/utils/tool-batch';
import { SOFTENED_LOOKUP_MISS } from '@/lib/utils/softened-miss';
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
      { i: 1, tool: 'search_cases', success: false, error: null },
      { i: 2, tool: 'search_notes', success: true },
      { i: 3, tool: 'get_note', success: true },
      { i: 4, tool: 'search_statutes', success: true },
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
          { i: 1, tool: 'search_cases', success: true },
          { i: 2, tool: 'search_notes', success: false },
          { i: 3, tool: 'get_note', success: true, note_title: 'TEST DATA SIM-swap liability note' },
          { i: 4, tool: 'search_statutes', success: true },
        ],
      },
    } as ApiMessage,
  ];
  const [step] = transformApiMessages(saved).filter((message) => message.role === 'tool') as ToolMessage[];
  assert.equal(step.toolName, RUN_TOGETHER);
  assert.equal(step.toolStatus, 'complete');
  assert.deepEqual(states(step.batch!), ['done', 'failed', 'done', 'done']);
  assert.equal(step.batch![2].entityTitle, 'TEST DATA SIM-swap liability note');
  // i counts from 1: batch_calls' first entry is the first lookup, never the second.
  const first = batchFromReload(parameters, [{ i: 1, tool: 'search_cases', success: false }]);
  assert.deepEqual(states(first), ['failed', 'unfinished', 'unfinished', 'unfinished']);
  // A call the server refused (no tool) keeps its place, so the rows after it keep theirs.
  const refused = batchFromReload({ calls: [{ arguments: {} }, { tool: 'get_note', arguments: { note_id: 1 } }] }, [
    { i: 1, success: false },
    { i: 2, tool: 'get_note', success: true },
  ]);
  assert.deepEqual(states(refused), ['failed', 'done']);
  // Saved without batch_calls or results: nothing says any lookup worked, so none is a tick.
  assert.deepEqual(states(batchFromReload(parameters, undefined)), ['unfinished', 'unfinished', 'unfinished', 'unfinished']);
});

test('the chat listens for the batch events and draws the sub-rows under the goal line; a single step is unchanged', () => {
  const engine = readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');
  assert.match(engine, /es\.addEventListener\('tool_batch_calling'[\s\S]*?updateBatch\(event\.parent_tool_call_id, \(batch\) =>\s*batchOnCalling\(/);
  assert.match(engine, /es\.addEventListener\('tool_batch_complete'[\s\S]*?updateBatch\(event\.parent_tool_call_id, \(batch\) =>\s*batchOnComplete\(/);
  assert.match(engine, /if \(event\.tool_call\.name === RUN_TOGETHER && event\.tool_call_id\) batches\.set\(event\.tool_call_id, msgId\);/);
  const item = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx'), 'utf8');
  assert.match(item, /case RUN_TOGETHER:\s*return \{ action: batchGoal\(parameters\)/);
  assert.match(item, /\{batch \? <BatchRows calls=\{batch\} \/> : null\}/);
});

/* Techlead review of f6dd70e7 (24 November 2026). */

const engineSource = () => readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');
const softened = { success: true, data: { message: SOFTENED_LOOKUP_MISS }, error: null };

const savedBatch = (result: Record<string, unknown> | null, batchCalls?: unknown[]): ToolMessage => {
  const at = '2026-11-24T06:10:00+00:00';
  const rows: ApiMessage[] = [
    {
      id: 700101, conversation_id: 'TEST-chat', agent_id: 1, role: 'assistant', content: '', created_at: at,
      metadata: { type: 'tool_call', iteration: 1, tool_call_id: 'call_b', tool_name: RUN_TOGETHER, tool_parameters: parameters },
    } as ApiMessage,
  ];
  if (result) {
    rows.push({
      id: 700102, conversation_id: 'TEST-chat', agent_id: 1, role: 'tool', created_at: at,
      content: JSON.stringify(result),
      metadata: { type: 'tool_result', iteration: 1, tool_call_id: 'call_b', tool_name: RUN_TOGETHER, ...(batchCalls ? { batch_calls: batchCalls } : {}) },
    } as ApiMessage);
  }
  return transformApiMessages(rows).find((message) => message.role === 'tool') as ToolMessage;
};

test('two lookups with the same tool each land on their own row, by their id or by i', () => {
  const twice = {
    goal: 'TEST DATA two case searches',
    calls: [
      { tool: 'search_cases', arguments: { query: 'TEST DATA first' } },
      { tool: 'search_cases', arguments: { query: 'TEST DATA second' } },
      { tool: 'get_note', arguments: { note_id: 1 } },
    ],
  };
  let batch = batchFromParameters(twice);
  batch = batchOnCalling(batch, { callId: 'call_b.2', tool: 'search_cases' });
  batch = batchOnCalling(batch, { callId: 'call_b.1', tool: 'search_cases' });
  batch = batchOnComplete(batch, { callId: 'call_b.2', tool: 'search_cases', result: failed });
  assert.deepEqual(states(batch), ['working', 'failed', 'waiting']);
  assert.deepEqual([batch[0].callId, batch[1].callId], ['call_b.1', 'call_b.2']);
  batch = batchOnComplete(batch, { callId: 'call_b.1', tool: 'search_cases', result: ok() });
  assert.deepEqual(states(batch), ['done', 'failed', 'waiting']);
  // The end's results and batch_calls go by i (from 1, as Backend counts), whatever order they come in.
  const ended = batchOnEnd(batchFromParameters(twice), {
    results: [
      { i: 3, tool: 'get_note', success: true },
      { i: 1, tool: 'search_cases', success: false },
      { i: 2, tool: 'search_cases', success: true },
    ],
  });
  assert.deepEqual(states(ended), ['failed', 'done', 'done']);
  const reloaded = batchFromReload(twice, [
    { i: 2, tool: 'search_cases', success: true },
    { i: 1, tool: 'search_cases', success: false },
    { i: 3, tool: 'get_note', success: true },
  ]);
  assert.deepEqual(states(reloaded), ['failed', 'done', 'done']);
});

test('a masked failure (the softened miss a regular reader gets as success) reads "did not work", live and after a reload', () => {
  // Live: the inner event says success, with the softened sentence in place of the error.
  let live = batchFromParameters(parameters);
  live = batchOnCalling(live, { callId: 'call_b.3', tool: 'get_note' });
  live = batchOnComplete(live, { callId: 'call_b.3', tool: 'get_note', result: softened });
  assert.equal(live[2].state, 'failed');
  const asError = batchOnComplete(batchFromParameters(parameters), {
    callId: 'call_b.3', tool: 'get_note', result: { success: true, data: null, error: SOFTENED_LOOKUP_MISS },
  });
  assert.equal(asError[2].state, 'failed');
  // The end says success for it too; it stays failed, and the others settle.
  live = batchOnEnd(live, {
    results: [
      { i: 1, tool: 'search_cases', success: true },
      { i: 2, tool: 'search_notes', success: true },
      { i: 3, tool: 'get_note', success: true, result: { message: SOFTENED_LOOKUP_MISS } },
      { i: 4, tool: 'search_statutes', success: true },
    ],
  });
  assert.deepEqual(states(live), ['done', 'done', 'failed', 'done']);
  // An end entry alone that carries the softened sentence reads failed.
  const endOnly = batchOnEnd(batchFromParameters(parameters), {
    results: [{ i: 3, tool: 'get_note', success: true, result: { message: SOFTENED_LOOKUP_MISS } }],
  });
  assert.equal(endOnly[2].state, 'failed');

  // Reload: batch_calls keeps the real flag (Backend), so the same row reads failed.
  const reloaded = savedBatch({ success: true, data: { goal: parameters.goal, done: 3, failed: 1, results: [] }, error: null }, [
    { i: 1, tool: 'search_cases', success: true },
    { i: 2, tool: 'search_notes', success: true },
    { i: 3, tool: 'get_note', success: false },
    { i: 4, tool: 'search_statutes', success: true },
  ]);
  assert.deepEqual(states(reloaded.batch!), states(live));
  // A batch_calls row saved as success with the softened result beside it: the fallback reads it failed.
  const fallback = savedBatch(
    { success: true, data: { results: [{ i: 3, tool: 'get_note', success: true, result: { message: SOFTENED_LOOKUP_MISS } }] }, error: null },
    [
      { i: 1, tool: 'search_cases', success: true },
      { i: 2, tool: 'search_notes', success: true },
      { i: 3, tool: 'get_note', success: true },
      { i: 4, tool: 'search_statutes', success: true },
    ],
  );
  assert.deepEqual(states(fallback.batch!), ['done', 'done', 'failed', 'done']);
  // No batch_calls, only the saved results: the same.
  const resultsOnly = savedBatch({
    success: true,
    data: {
      results: [
        { i: 1, tool: 'search_cases', success: true },
        { i: 2, tool: 'search_notes', success: true },
        { i: 3, tool: 'get_note', success: true, error: SOFTENED_LOOKUP_MISS },
        { i: 4, tool: 'search_statutes', success: true },
      ],
    },
    error: null,
  });
  assert.deepEqual(states(resultsOnly.batch!), ['done', 'done', 'failed', 'done']);
});

test('a reload with no or part of batch_calls ticks only what something says worked', () => {
  // A result with no batch_calls and no results: nothing worked that we know of.
  const bare = savedBatch({ success: true, data: { goal: parameters.goal, done: 4, failed: 0 }, error: null });
  assert.deepEqual(states(bare.batch!), ['unfinished', 'unfinished', 'unfinished', 'unfinished']);
  // The step itself failed.
  const stepFailed = savedBatch({ success: false, data: null, error: 'TEST DATA batch failed' });
  assert.deepEqual(states(stepFailed.batch!), ['unfinished', 'unfinished', 'unfinished', 'unfinished']);
  // No saved result at all.
  const noResult = savedBatch(null);
  assert.deepEqual(states(noResult.batch!), ['unfinished', 'unfinished', 'unfinished', 'unfinished']);
  assert.equal(noResult.batchCallId, 'call_b');
  // Part of batch_calls, out of order: the rows it names, by i; the rest unfinished.
  const partial = savedBatch({ success: true, data: null, error: null }, [
    { i: 3, tool: 'get_note', success: true, note_title: 'TEST DATA note' },
    { i: 1, tool: 'search_cases', success: false },
  ]);
  assert.deepEqual(states(partial.batch!), ['failed', 'unfinished', 'done', 'unfinished']);
  assert.equal(partial.batch![2].entityTitle, 'TEST DATA note');
  // A turn still running when the chat reloaded: its batch's open lookups wait again.
  assert.deepEqual(states(batchOnFollow(partial.batch!)), ['failed', 'waiting', 'done', 'waiting']);
  const engine = engineSource();
  assert.match(engine, /turnOrigin: 'followed' \}\)\);\s*followBatches\(\);/);
  assert.match(engine, /function followBatches\(\)[\s\S]*?index > start && msg\.role === 'tool' && !!tool\.batch && !tool\.toolResult && !!tool\.batchCallId/);
  assert.match(engine, /batches\.set\(tool\.batchCallId!, msg\.id\);/);
});

test('a lookup event that arrives after the batch ended changes nothing', () => {
  let batch = batchFromParameters(parameters);
  batch = batchOnCalling(batch, { callId: 'call_b.1', tool: 'search_cases' });
  batch = batchOnEnd(batch, {
    results: [
      { i: 1, tool: 'search_cases', success: true },
      { i: 2, tool: 'search_notes', success: false },
      { i: 3, tool: 'get_note', success: true },
      { i: 4, tool: 'search_statutes', success: true },
    ],
  });
  assert.equal(batchSettled(batch), true);
  const late = batchOnComplete(batch, { callId: 'call_b.1', tool: 'search_cases', result: failed });
  assert.deepEqual(states(late), ['done', 'failed', 'done', 'done']);
  const lateStart = batchOnCalling(batch, { callId: 'call_b.2', tool: 'search_notes' });
  assert.deepEqual(states(lateStart), ['done', 'failed', 'done', 'done']);
  // A repeated completion keeps the row's first end.
  let twice = batchOnComplete(batchFromParameters(parameters), { callId: 'call_b.1', tool: 'search_cases', result: ok() });
  twice = batchOnComplete(twice, { callId: 'call_b.1', tool: 'search_cases', result: failed });
  assert.equal(twice[0].state, 'done');
  // The engine drops any event for a batch whose every lookup has ended.
  assert.match(engineSource(), /return batch && !batchSettled\(batch\) \? \(\{ \.\.\.msg, batch: change\(batch\) \} as ToolMessage\) : msg;/);
});

test('a Stop mid-batch settles the open lookups to stopped; any other early end to unfinished', () => {
  let batch = batchFromParameters(parameters);
  batch = batchOnCalling(batch, { callId: 'call_b.1', tool: 'search_cases' });
  batch = batchOnCalling(batch, { callId: 'call_b.2', tool: 'search_notes' });
  batch = batchOnComplete(batch, { callId: 'call_b.2', tool: 'search_notes', result: ok() });
  assert.deepEqual(states(batchOnHalt(batch, 'stopped')), ['stopped', 'done', 'stopped', 'stopped']);
  assert.deepEqual(states(batchOnHalt(batch, 'unfinished')), ['unfinished', 'done', 'unfinished', 'unfinished']);
  assert.equal(batchSettled(batchOnHalt(batch, 'stopped')), true);
  const engine = engineSource();
  // Both Stop paths: the cancelled event and the CANCELLED error.
  assert.match(engine, /es\.addEventListener\('cancelled'[\s\S]*?closeBatches\('stopped'\);/);
  assert.match(engine, /closeBatches\(parsed\?\.error_code === 'CANCELLED' \? 'stopped' : 'unfinished'\);/);
  // A timeout, a lost login and a stream that ends without the batch's end.
  assert.match(engine, /es\.addEventListener\('timeout'[\s\S]*?closeBatches\('unfinished'\);/);
  assert.match(engine, /function closeFinishedTurn\(\): void \{[\s\S]*?closeBatches\('unfinished'\);/);
  // On screen: neither a tick nor a spinner, and the row says how it ended.
  const item = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx'), 'utf8');
  assert.match(item, /unfinished: 'halted',\s*stopped: 'halted',/);
  // The goal line stops spinning too, once every lookup has ended without the batch's end.
  assert.match(item, /const batchHalted = !isComplete && !!message\.batch\?\.length && batchSettled\(message\.batch\);/);
  assert.match(item, /const status = batchHalted \? 'halted' :/);
  assert.match(item, /failed: 'did not work',\s*unfinished: 'did not finish',\s*stopped: 'stopped',/);
});
