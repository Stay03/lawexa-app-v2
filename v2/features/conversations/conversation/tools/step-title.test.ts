import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ToolMessage } from '@/types/chat';
import { readStepTitle } from './tool-content';

/* #13 (Stay, 3 October 2026): a read step names the note or case it read. */
const at = '2026-10-04T02:00:00Z';
const call = (id: number, tool: string, params: Record<string, unknown>): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'assistant', content: '',
  metadata: { type: 'tool_call', tool_name: tool, tool_parameters: params, iteration: id },
  created_at: at,
});
const lazyResult = (id: number, iteration: number, meta: Record<string, unknown>): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'tool', content: '', has_result: true,
  metadata: { type: 'tool_result', iteration, success: true, latency_ms: 30, ...meta },
  created_at: at,
});
const step = (messages: ApiMessage[]) =>
  transformApiMessages(messages).find((m): m is ToolMessage => m.role === 'tool')!;

test('a lazy note step carries the note title the transcript sends', () => {
  const s = step([call(1, 'view_note', { id: 631 }), lazyResult(2, 1, { note_title: 'Promissory estoppel in Nigeria' })]);
  assert.equal(s.entityTitle, 'Promissory estoppel in Nigeria');
});

test('a lazy case step carries the case title', () => {
  const s = step([call(1, 'view_case', { case_id: 11663 }), lazyResult(2, 1, { case_title: 'Piedmount Plywoods v Goldeac' })]);
  assert.equal(s.entityTitle, 'Piedmount Plywoods v Goldeac');
});

test('a step without the field has no title, so the label keeps the id', () => {
  const s = step([call(1, 'view_note', { id: 631 }), lazyResult(2, 1, {})]);
  assert.equal(s.entityTitle, undefined);
});

test('a loaded result gives its title, wrapped or not, display title first', () => {
  assert.equal(readStepTitle({ data: { note: { title: 'Contract basics' } } }), 'Contract basics');
  assert.equal(readStepTitle({ data: { data: { case: { title: 'A v B', display_title: 'A v B (2001)' } } } }), 'A v B (2001)');
  assert.equal(readStepTitle({ data: { note: { title: '   ' } } }), null);
  assert.equal(readStepTitle({ data: 'plain text' }), null);
});
