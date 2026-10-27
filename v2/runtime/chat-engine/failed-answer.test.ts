import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage, ErrorMessage } from '@/types/chat';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';

/* A Lawexa answer that fails after it has started shows none of the text that
 * streamed, and the turn is free (Stay, 27 October 2026). The server says so
 * (Backend, failed-turns-free a967cbb9): `discard_partial: true` and
 * `charged: false` on the `error` and `timeout` events, and on a reload the
 * turn's text rows come back `status: 'failed'` with no content. The row in
 * its place says so in grey. A user Stop keeps its text. The engine is driven
 * by a live EventSource, so it is pinned by source; the reload is a pure
 * transform, tested by behaviour. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const engine = () => read('v2', 'runtime', 'chat-engine', 'engine.ts');

test('a failed turn takes its answer off the list, text and all', () => {
  const source = engine();
  const withdraw = source.slice(source.indexOf('function withdrawOpenPlaceholder(): boolean {'));
  assert.match(withdraw, /if \(!placeholderId\) return false;/);
  assert.match(withdraw, /clearText\(placeholderId\);\s*takeReasoning\(placeholderId\);/);
  assert.match(withdraw, /setMessages\(\(msgs\) => msgs\.filter\(\(m\) => m\.id !== placeholderId\)\);/);
  assert.match(withdraw, /streamingMessageId = null;\s*currentIteration = null;\s*return true;/);
});

test('an error the server marks discard_partial withdraws the text and adds the failed row', () => {
  const source = engine();
  assert.match(source, /const failedTurn = parsed\?\.discard_partial === true;\s*if \(failedTurn\) withdrawOpenPlaceholder\(\);\s*else finalizeOpenPlaceholder\('error'\);/);
  assert.match(source, /addErrorMessage\(errorMsg, errorCode, retryable \|\| failedTurn, retryAfterMs, null, failedTurn\);/);
  assert.match(source, /\.\.\.\(failedAnswer \? \{ failedAnswer: true \} : \{\}\),/);
});

test('a timeout the server marks discard_partial withdraws too, with Try again; an older one keeps its text', () => {
  const source = engine();
  const timeout = source.slice(source.indexOf("es.addEventListener('timeout'"), source.indexOf('es.onerror'));
  assert.match(timeout, /parseEvent<\{ discard_partial\?: boolean \}>\(\(e as MessageEvent\)\.data\)\?\.discard_partial === true;/);
  assert.match(timeout, /if \(failedTurn\) \{\s*withdrawOpenPlaceholder\(\);\s*addErrorMessage\(errorMsg, 'TIMEOUT', true, null, null, true\);/);
  assert.match(timeout, /\.\.\.\(content \? \{ partial: \{ reason: 'timeout' as const \} \} : \{\}\),/);
});

test('a user Stop and a dropped connection keep the text they showed', () => {
  const source = engine();
  // Both stop paths, the cancelled event and the CANCELLED error, end the same way.
  const cancelled = source.slice(source.indexOf("es.addEventListener('cancelled'"));
  assert.match(cancelled, /toolCallQueue\.clear\(\);\s*stopOpenPlaceholder\(\);/);
  assert.match(source, /if \(parsed\?\.error_code === 'CANCELLED'\) \{\s*stopOpenPlaceholder\(\);/);
  // A 401 mid-stream keeps what was streamed; the server decides later.
  const onerror = source.slice(source.indexOf('es.onerror = () => {'));
  assert.match(onerror, /if \(loginRejected\) \{[\s\S]*?finalizeOpenPlaceholder\('error'\);/);
});

test('the failed row is grey and says it was not finished and not charged', () => {
  const row = read('v2', 'features', 'conversations', 'conversation', 'rows', 'ErrorRow.tsx');
  assert.match(row, /export const FAILED_ANSWER_LINE = "Lawexa couldn't finish this answer\.";/);
  assert.match(row, /export const FAILED_ANSWER_FREE = "It wasn't counted against your messages\.";/);
  const start = row.indexOf('if (message.failedAnswer) {');
  const failed = row.slice(start, row.indexOf('border-destructive/30', start));
  assert.ok(start > 0 && failed.length > 0);
  assert.doesNotMatch(failed, /destructive/);
  assert.match(failed, /\{FAILED_ANSWER_LINE\}/);
  assert.match(failed, /\{FAILED_ANSWER_FREE\}/);
  assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /message\.content/);
});

/* ── On a reload ──────────────────────────────────────────────────────────── */

let nextId = 1;
function row(fields: Partial<ApiMessage> & Pick<ApiMessage, 'role'>): ApiMessage {
  const id = nextId++;
  return {
    id,
    conversation_id: 'c1',
    agent_id: null,
    content: '',
    metadata: {},
    created_at: `2026-10-27T13:00:${String(id).padStart(2, '0')}Z`,
    ...fields,
  } as ApiMessage;
}

test('a failed turn reloads as ONE failed row, however many text rows it had', () => {
  const messages = transformApiMessages([
    row({ role: 'user', content: 'What is the limitation period for contract claims?' }),
    row({ role: 'assistant', status: 'failed', failure_message: 'server words', metadata: { execution_id: 'e1' } }),
    row({ role: 'assistant', status: 'failed', failure_message: 'server words', metadata: { execution_id: 'e1' } }),
  ]);
  assert.equal(messages.length, 2);
  const failed = messages[1] as ErrorMessage;
  assert.equal(failed.messageType, 'error');
  assert.equal(failed.failedAnswer, true);
  assert.equal(failed.errorCode, 'FAILED_TURN');
});

test('two failed turns are two rows, and answered turns are untouched', () => {
  const messages = transformApiMessages([
    row({ role: 'user', content: 'first' }),
    row({ role: 'assistant', status: 'failed', metadata: { execution_id: 'e1' } }),
    row({ role: 'user', content: 'second' }),
    row({ role: 'assistant', content: 'A real answer.', metadata: { execution_id: 'e2' } }),
    row({ role: 'user', content: 'third' }),
    row({ role: 'assistant', status: 'failed', metadata: { execution_id: 'e3' } }),
  ]);
  assert.deepEqual(
    messages.map((message) => ('failedAnswer' in message && message.failedAnswer ? 'failed' : message.role)),
    ['user', 'failed', 'user', 'assistant', 'user', 'failed'],
  );
  assert.equal(messages[3].content, 'A real answer.');
});

test('a stopped answer is marked Stopped at once, and a stop before the first word leaves no blank row', () => {
  const source = engine();
  const helper = source.slice(source.indexOf('function stopOpenPlaceholder(): void {'));
  // The text so far stays, tagged as the reload's `partial` row is, so the row draws "Stopped".
  assert.match(helper, /const content = finalText \|\| m\.content;/);
  assert.match(helper, /return content \? \[\{ \.\.\.m, content, isStreaming: false, \.\.\.trace, partial: \{ reason: 'cancelled' as const \} \}\] : \[\];/);
  // The reasoning is taken before the iteration it is keyed by is forgotten.
  assert.ok(helper.indexOf('takeReasoning(placeholderId)') < helper.indexOf('messageIdToIteration.delete(placeholderId)'));
  // The row's mark for that tag.
  const row = read('v2', 'features', 'conversations', 'conversation', 'rows', 'AssistantMessageRow.tsx');
  assert.match(row, /partial\.reason === 'cancelled' \? \(\s*<>\s*<Square className="h-3 w-3" \/>\s*<span>Stopped<\/span>/);
});
