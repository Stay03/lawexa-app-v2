import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COMPACTED_DETAIL, COMPACTED_LABEL, CONTEXT_COMPACTED_STEP, compactedStep } from '@/lib/utils/context-compacted';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ToolMessage } from '@/types/chat';

/* "Earlier reading summarised" (Stay, 16 November 2026; Backend's context_compacted shapes). TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const at = '2026-11-16T18:00:00Z';
const row = (id: number, role: ApiMessage['role'], metadata: ApiMessage['metadata'], content = ''): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role, content, metadata, created_at: at,
});

test('the step is a finished step with the quiet line, and no result to fetch', () => {
  const step = compactedStep('s1', new Date(at), 'researcher');
  assert.equal(step.toolName, CONTEXT_COMPACTED_STEP);
  assert.equal(step.toolStatus, 'complete');
  assert.equal(step.resultRef, undefined);
  assert.equal(step.agentSlug, 'researcher');
  assert.equal(compactedStep('s2', new Date(at)).agentSlug, undefined, 'Lawexa itself');
  const item = read('v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx');
  assert.match(item, /case CONTEXT_COMPACTED_STEP:\s*return \{ action: COMPACTED_LABEL \};/);
  assert.equal(COMPACTED_LABEL, 'Earlier reading summarised');
  assert.match(COMPACTED_DETAIL, /summarised what it read earlier/);
});

test('a reopened chat draws it where it happened, among the steps', () => {
  const messages = transformApiMessages([
    row(1, 'user', null, 'TEST DATA. A long question.'),
    row(2, 'assistant', { type: 'tool_call', tool_name: 'read_statute', tool_parameters: { section: '1' }, iteration: 1 }),
    row(3, 'tool', { type: 'tool_result', iteration: 1, success: true }, JSON.stringify({ success: true, data: {} })),
    row(4, 'assistant', { type: 'context_compacted', iteration: 2, agent_slug: null }),
    row(5, 'assistant', { type: 'tool_call', tool_name: 'read_statute', tool_parameters: { section: '1' }, iteration: 2 }),
    row(6, 'tool', { type: 'tool_result', iteration: 2, success: true }, JSON.stringify({ success: true, data: {} })),
    row(7, 'assistant', null, 'TEST DATA. The answer.'),
  ]);
  const steps = messages.filter((m): m is ToolMessage => m.role === 'tool').map((m) => m.toolName);
  assert.deepEqual(steps, ['read_statute', CONTEXT_COMPACTED_STEP, 'read_statute']);
  const answer = messages.at(-1);
  assert.equal(answer?.role, 'assistant');
  assert.equal(answer?.content, 'TEST DATA. The answer.', 'the empty row is never drawn as an answer');
});

test('live: the event adds the step once, and the opened step says what happened', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /es\.addEventListener\('context_compacted', \(e\) => \{[\s\S]{0,400}if \(event\.seq !== undefined && dedup\.has\(event\.seq\)\) return;\s*const step = compactedStep\(generateId\(\), new Date\(\), event\.agent_slug\);\s*setMessages\(\(msgs\) => \[\.\.\.msgs, step\]\);/);
  const item = read('v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx');
  assert.match(item, /if \(message\.toolName === CONTEXT_COMPACTED_STEP\) \{\s*return <p className="text-muted-foreground text-sm leading-relaxed">\{COMPACTED_DETAIL\}<\/p>;/);
});
