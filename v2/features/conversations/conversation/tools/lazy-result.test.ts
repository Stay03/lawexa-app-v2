import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToolResult, transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ToolMessage } from '@/types/chat';

const at = '2026-10-02T20:00:00Z';
const call = (id: number, iteration: number, tool = 'read_statute'): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'assistant', content: '',
  metadata: { type: 'tool_call', tool_name: tool, tool_parameters: { section: '10' }, iteration },
  created_at: at,
});
const result = (id: number, iteration: number, over: Partial<ApiMessage> = {}, meta: Record<string, unknown> = {}): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'tool', content: '',
  metadata: { type: 'tool_result', iteration, success: true, latency_ms: 120, ...meta },
  created_at: at,
  ...over,
});

const tools = (messages: ApiMessage[]) =>
  transformApiMessages(messages).filter((m): m is ToolMessage => m.role === 'tool');

test('a lazy result keeps its tick, time and statute name, and a reference to fetch it by', () => {
  const [step] = tools([
    call(10, 1),
    result(11, 1, { has_result: true, result_bytes: 5400 }, { statute_title: 'Electoral Act 2026' }),
  ]);
  assert.equal(step.toolResult?.success, true);
  assert.equal(step.toolResult?.data, null);
  assert.equal(step.latencyMs, 120);
  assert.equal(step.statuteTitle, 'Electoral Act 2026');
  assert.deepEqual(step.resultRef, { messageId: 11, size: 5400 });
});

test('a failed lazy step stays failed, with its error', () => {
  const [step] = tools([
    call(20, 2),
    result(21, 2, { has_result: true }, { success: false, error: 'Statute not found' }),
  ]);
  assert.equal(step.toolResult?.success, false);
  assert.equal(step.toolResult?.error, 'Statute not found');
});

test('a result that came with the chat is read as before, with no reference', () => {
  const [step] = tools([
    call(30, 3, 'search_cases'),
    result(31, 3, { content: JSON.stringify({ success: true, data: { results: [{ id: 1 }] } }) }),
  ]);
  assert.deepEqual(step.toolResult?.data, { results: [{ id: 1 }] });
  assert.equal(step.resultRef, undefined);
});

test('a fetched result parses the same way the chat download does', () => {
  assert.deepEqual(
    parseToolResult({ content: JSON.stringify({ data: { statute: { title: 'X' } } }), metadata: { success: true } }),
    { success: true, data: { statute: { title: 'X' } }, error: null },
  );
  assert.deepEqual(parseToolResult({ content: 'plain text', metadata: null }), { success: true, data: 'plain text', error: null });
});
