import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A Lawexa answer that fails after it has started (an error or a timeout mid-
 * stream) shows none of the text that streamed, and the turn is free (Stay,
 * 27 October 2026). The row that stands in its place says so in grey. A user
 * Stop keeps its text. Pinned by source: the engine is driven by a live
 * EventSource. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const engine = () => read('v2', 'runtime', 'chat-engine', 'engine.ts');

test('an answer that had started is taken off the list, text and all', () => {
  const source = engine();
  const withdraw = source.slice(source.indexOf('function withdrawOpenPlaceholder(): boolean {'));
  assert.match(withdraw, /if \(!placeholderId\) return false;/);
  assert.match(withdraw, /clearText\(placeholderId\);\s*takeReasoning\(placeholderId\);/);
  assert.match(withdraw, /setMessages\(\(msgs\) => msgs\.filter\(\(m\) => m\.id !== placeholderId\)\);/);
  assert.match(withdraw, /streamingMessageId = null;\s*currentIteration = null;\s*return true;/);
});

test('an error mid-answer withdraws the text and adds the failed row', () => {
  const source = engine();
  assert.match(source, /const started = withdrawOpenPlaceholder\(\);/);
  assert.match(source, /addErrorMessage\(errorMsg, errorCode, retryable, retryAfterMs, null, started\);/);
  assert.match(source, /\.\.\.\(failedAnswer \? \{ failedAnswer: true \} : \{\}\),/);
});

test('a timeout mid-answer withdraws the text too, with Try again', () => {
  const source = engine();
  const timeout = source.slice(source.indexOf("es.addEventListener('timeout'"));
  assert.match(timeout, /if \(withdrawOpenPlaceholder\(\)\) \{\s*addErrorMessage\(errorMsg, 'TIMEOUT', true, null, null, true\);/);
  assert.doesNotMatch(timeout.slice(0, timeout.indexOf('es.onerror')), /reason: 'timeout'/);
});

test('a user Stop keeps the text it showed', () => {
  const source = engine();
  const cancelled = source.slice(source.indexOf("es.addEventListener('cancelled'"));
  assert.match(cancelled, /m\.id === placeholderId \? \{ \.\.\.m, content: finalText, isStreaming: false \} : m,/);
  assert.match(source, /if \(parsed\?\.error_code === 'CANCELLED'\) \{/);
});

test('the failed row is grey and says it was not finished and not charged', () => {
  const row = read('v2', 'features', 'conversations', 'conversation', 'rows', 'ErrorRow.tsx');
  assert.match(row, /export const FAILED_ANSWER_LINE = "Lawexa couldn't finish this answer\.";/);
  assert.match(row, /export const FAILED_ANSWER_FREE = "It wasn't counted against your messages\.";/);
  // The failed row's block: from its branch to the red banner after it.
  const start = row.indexOf('if (message.failedAnswer) {');
  const failed = row.slice(start, row.indexOf('border-destructive/30', start));
  assert.ok(start > 0 && failed.length > 0);
  assert.doesNotMatch(failed, /destructive/);
  assert.match(failed, /\{FAILED_ANSWER_LINE\}/);
  assert.match(failed, /\{FAILED_ANSWER_FREE\}/);
  assert.match(failed, /Try again/);
  // The server's error text is not what this row says.
  assert.doesNotMatch(failed, /message\.content/);
});
