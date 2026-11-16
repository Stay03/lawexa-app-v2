import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCallMatcher } from '@/lib/utils/tool-call-match';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, HandoverMessage, ToolMessage } from '@/types/chat';

/* Tool results reach the call that asked for them (16 November 2026). The AI service can
 * run several calls in one iteration, and the results can come back in any order.
 * `tool_call_id` decides when both sides carry it; without it the old order still holds. */

// ---- Live (the stream's events) ----

test('live: the same tool twice, results back in reverse order, each reaches its own row', () => {
  const m = createCallMatcher();
  m.open('read_statute', 'row-a', 'call_1');
  m.open('read_statute', 'row-b', 'call_2');
  assert.equal(m.close('read_statute', 'call_2'), 'row-b');
  assert.equal(m.close('read_statute', 'call_1'), 'row-a');
  assert.equal(m.close('read_statute', 'call_1'), undefined);
});

test('live: different tools in one iteration, results back out of order', () => {
  const m = createCallMatcher();
  m.open('read_statute', 'row-a', 'call_1');
  m.open('search_cases', 'row-b', 'call_2');
  m.open('read_statute', 'row-c', 'call_3');
  assert.equal(m.close('read_statute', 'call_3'), 'row-c');
  assert.equal(m.close('search_cases', 'call_2'), 'row-b');
  assert.equal(m.close('read_statute', 'call_1'), 'row-a');
});

test('live: without ids, a result closes the oldest open row for its tool, as before', () => {
  const m = createCallMatcher();
  m.open('read_statute', 'row-a');
  m.open('search_cases', 'row-b');
  m.open('read_statute', 'row-c');
  assert.equal(m.close('read_statute'), 'row-a');
  assert.equal(m.close('read_statute'), 'row-c');
  assert.equal(m.close('search_cases'), 'row-b');
  assert.equal(m.close('search_cases'), undefined);
});

test('live: an id the stream never opened falls back to the oldest open row, and no row closes twice', () => {
  const m = createCallMatcher();
  m.open('read_statute', 'row-a', 'call_1');
  m.open('read_statute', 'row-b', 'call_2');
  assert.equal(m.close('read_statute', 'call_9'), 'row-a');
  assert.equal(m.close('read_statute', 'call_2'), 'row-b');
  assert.equal(m.close('read_statute', 'call_1'), undefined);
});

test('live: two handovers to the same agent, finished in reverse order', () => {
  const m = createCallMatcher();
  m.open('researcher', 'ho-a', 'call_1');
  m.open('researcher', 'ho-b', 'call_2');
  assert.equal(m.close('researcher', 'call_2'), 'ho-b');
  assert.equal(m.close('researcher', 'call_1'), 'ho-a');
});

test('live: clear forgets every open row', () => {
  const m = createCallMatcher();
  m.open('read_statute', 'row-a', 'call_1');
  m.clear();
  assert.equal(m.close('read_statute', 'call_1'), undefined);
  assert.equal(m.close('read_statute'), undefined);
});

// ---- History (the saved chat) ----

const at = '2026-11-16T06:00:00Z';
const row = (id: number, role: ApiMessage['role'], metadata: ApiMessage['metadata'], content = ''): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role, content, metadata, created_at: at,
});
const call = (id: number, tool: string, section: string, callId?: string) =>
  row(id, 'assistant', {
    type: 'tool_call', tool_name: tool, tool_parameters: { section }, iteration: 1,
    ...(callId && { tool_call_id: callId }),
  });
const result = (id: number, answer: string, callId?: string) =>
  row(id, 'tool', {
    type: 'tool_result', iteration: 1, success: true, latency_ms: 100,
    ...(callId && { tool_call_id: callId }),
  }, JSON.stringify({ success: true, data: { answer } }));

const tools = (rows: ApiMessage[]) =>
  transformApiMessages(rows)
    .filter((m): m is ToolMessage => m.role === 'tool')
    .map((m) => [m.toolParameters?.section, (m.toolResult?.data as { answer?: string } | null)?.answer]);

test('history: the same tool twice in one iteration, results saved in reverse order, with ids', () => {
  assert.deepEqual(
    tools([
      call(1, 'read_statute', '10', 'call_1'),
      call(2, 'read_statute', '20', 'call_2'),
      result(3, 'section 20 text', 'call_2'),
      result(4, 'section 10 text', 'call_1'),
    ]),
    [['10', 'section 10 text'], ['20', 'section 20 text']],
  );
});

test('history: different tools in one iteration, results saved out of order, with ids', () => {
  assert.deepEqual(
    tools([
      call(1, 'read_statute', '10', 'call_1'),
      call(2, 'search_cases', 'q', 'call_2'),
      call(3, 'read_statute', '30', 'call_3'),
      result(4, 'cases found', 'call_2'),
      result(5, 'section 30 text', 'call_3'),
      result(6, 'section 10 text', 'call_1'),
    ]),
    [['10', 'section 10 text'], ['q', 'cases found'], ['30', 'section 30 text']],
  );
});

test('history: without ids, results pair in saved order within the iteration, as before', () => {
  assert.deepEqual(
    tools([
      call(1, 'read_statute', '10'),
      call(2, 'read_statute', '20'),
      result(3, 'first saved'),
      result(4, 'second saved'),
    ]),
    [['10', 'first saved'], ['20', 'second saved']],
  );
});

test('history: a call without an id never takes a result that another call owns by id', () => {
  assert.deepEqual(
    tools([
      call(1, 'read_statute', '10'),
      call(2, 'read_statute', '20', 'call_2'),
      result(3, 'section 20 text', 'call_2'),
      result(4, 'section 10 text'),
    ]),
    [['10', 'section 10 text'], ['20', 'section 20 text']],
  );
});

test('history: two handovers in one iteration, results saved in reverse order, with ids', () => {
  const handover = (id: number, task: string, callId: string) =>
    row(id, 'assistant', { type: 'handover', target_agent: 'researcher', task, iteration: 1, tool_call_id: callId });
  const done = (id: number, text: string, callId: string) =>
    row(id, 'assistant', { type: 'handover_result', iteration: 1, success: true, latency_ms: 900, tool_call_id: callId }, text);
  const rows = transformApiMessages([
    handover(1, 'find the 2019 cases', 'call_1'),
    handover(2, 'find the 2024 cases', 'call_2'),
    done(3, '2024 answer', 'call_2'),
    done(4, '2019 answer', 'call_1'),
  ]).filter((m): m is HandoverMessage => (m as HandoverMessage).messageType === 'handover');
  assert.deepEqual(
    rows.map((m) => [m.task, m.handoverResultContent]),
    [['find the 2019 cases', '2019 answer'], ['find the 2024 cases', '2024 answer']],
  );
});
