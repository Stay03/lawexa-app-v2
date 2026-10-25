import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiMessage, ChatMessage } from '@/types/chat';
import { transformApiMessages } from './transform-api-messages';

/* 25 October 2026: a Radar report did not draw in the v2 chat. The Radar scan
 * stores it with metadata.type "radar_report"; the transform knew no such
 * type, so the message was dropped and the chat showed an empty body to
 * everyone, owner included. */

const here = dirname(fileURLToPath(import.meta.url));

const message = (id: number, role: ApiMessage['role'], content: string, metadata: ApiMessage['metadata'] = null): ApiMessage =>
  ({ id, conversation_id: 'c', agent_id: null, role, content, metadata, created_at: '2026-10-26T09:00:00Z' }) as ApiMessage;

const REPORT = '## TEST DATA Radar report\n\nThree new judgments on landlord deposits this week.';

test('a Radar report is drawn as an answer, marked as a Radar report', () => {
  const rows = transformApiMessages([message(41, 'assistant', REPORT, { type: 'radar_report' })]);
  assert.equal(rows.length, 1);
  const row = rows[0] as ChatMessage;
  assert.equal(row.id, 'msg_41');
  assert.equal(row.role, 'assistant');
  assert.equal(row.content, REPORT);
  assert.equal(row.kind, 'radar_report');
});

test('a Radar report after a question keeps its place, and a plain answer has no mark', () => {
  const rows = transformApiMessages([
    message(1, 'user', 'TEST DATA. What changed?'),
    message(2, 'assistant', 'TEST DATA. Here is the answer.'),
    message(3, 'assistant', REPORT, { type: 'radar_report' }),
  ]);
  assert.deepEqual(rows.map((row) => row.id), ['msg_1', 'msg_2', 'msg_3']);
  assert.equal((rows[1] as ChatMessage).kind, undefined);
  assert.equal((rows[2] as ChatMessage).kind, 'radar_report');
});

test('the answer row labels a Radar report in grey, above the text', () => {
  const row = readFileSync(join(here, '..', '..', 'v2', 'features', 'conversations', 'conversation', 'rows', 'AssistantMessageRow.tsx'), 'utf8');
  assert.match(row, /const radarReport = \(message as ChatMessage\)\.kind === 'radar_report';/);
  assert.match(row, /\{radarReport && \(\s*<div className="mb-1\.5 flex items-center gap-1\.5 text-xs font-medium text-muted-foreground">\s*<Radar aria-hidden className="h-3\.5 w-3\.5" \/>\s*<span>Radar report<\/span>/);
});
