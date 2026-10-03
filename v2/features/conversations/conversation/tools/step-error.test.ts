import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ToolMessage } from '@/types/chat';
import { extractStepError } from './tool-content';

const at = '2026-10-03T04:00:00Z';
const call = (id: number): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'assistant', content: '',
  metadata: { type: 'tool_call', tool_name: 'read_file', tool_parameters: {}, iteration: id },
  created_at: at,
});
const failed = (id: number, iteration: number, content: string): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'tool', content,
  metadata: { type: 'tool_result', iteration, success: false, latency_ms: 40 },
  created_at: at,
});
const step = (messages: ApiMessage[]) =>
  transformApiMessages(messages).find((m): m is ToolMessage => m.role === 'tool')!;

test('a reloaded failed step shows the error text the server stored', () => {
  assert.equal(extractStepError(step([call(1), failed(2, 1, 'File not found.')])), 'File not found.');
});

test('a stored JSON error gives its message', () => {
  const content = JSON.stringify({ success: false, message: 'This file type has no readable text.' });
  assert.equal(extractStepError(step([call(1), failed(2, 1, content)])), 'This file type has no readable text.');
});

test('a streamed step keeps the error it came with', () => {
  const message = { role: 'tool', toolResult: { success: false, data: null, error: 'Statute not found' } } as ToolMessage;
  assert.equal(extractStepError(message), 'Statute not found');
});

test('no stored text and a successful step both give null', () => {
  assert.equal(extractStepError(step([call(1), failed(2, 1, '   ')])), null);
  const ok = { role: 'tool', toolResult: { success: true, data: 'File not found.', error: null } } as ToolMessage;
  assert.equal(extractStepError(ok), null);
});
