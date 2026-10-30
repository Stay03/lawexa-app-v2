import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { noteFirstReadDelay, retryNoteFirstRead } from './first-read-retry';

/** An axios error as axios marks it: a response with a status, or none for a dropped request. */
const axiosError = (status?: number) => ({
  isAxiosError: true,
  message: 'Request failed',
  response: status === undefined ? undefined : { status },
});

/**
 * Runs the retry rule the way TanStack Query does: a read, then while the rule
 * says so, the wait and another read. Returns what the panel ends on and the
 * waits it sat through.
 */
function runReads(answers: Array<'found' | number | 'dropped'>): { result: 'found' | 'error'; waits: number[] } {
  const waits: number[] = [];
  for (let attempt = 0; ; attempt += 1) {
    const answer = answers[Math.min(attempt, answers.length - 1)];
    if (answer === 'found') return { result: 'found', waits };
    const error = answer === 'dropped' ? axiosError() : axiosError(answer);
    if (!retryNoteFirstRead(attempt, error)) return { result: 'error', waits };
    waits.push(noteFirstReadDelay(attempt));
  }
}

test('a 404 then found: the note opens after one wait of 1.5 s, no error shown', () => {
  assert.deepEqual(runReads([404, 'found']), { result: 'found', waits: [1500] });
  assert.deepEqual(runReads(['dropped', 404, 'found']), { result: 'found', waits: [1500, 3000] });
});

test('three failed reads show the error, after waits of 1.5 s and 3 s', () => {
  assert.deepEqual(runReads([404, 404, 404]), { result: 'error', waits: [1500, 3000] });
  assert.deepEqual(runReads(['dropped', 'dropped', 'dropped']), { result: 'error', waits: [1500, 3000] });
});

test('other answers keep their old rules', () => {
  // A settled refusal is not retried.
  assert.equal(retryNoteFirstRead(0, axiosError(403)), false);
  assert.equal(retryNoteFirstRead(0, axiosError(422)), false);
  // A server error gets one retry, as every notes read does.
  assert.equal(retryNoteFirstRead(0, axiosError(500)), true);
  assert.equal(retryNoteFirstRead(1, axiosError(500)), false);
});

test('both of the panel’s note reads use the rule; Try again stays', () => {
  const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');
  const queries = read('v2', 'features', 'notes', 'queries.ts');
  assert.equal((queries.match(/retry: retryNoteFirstRead,\s*retryDelay: noteFirstReadDelay,/g) ?? []).length, 2);
  assert.match(queries, /queryFn: \(\) => notesApi\.draftNotes\(conversationId\),[\s\S]{0,300}retry: retryNoteFirstRead,/);
  assert.match(queries, /queryFn: \(\) => notesApi\.byId\(id\),[\s\S]{0,300}retry: retryNoteFirstRead,/);
  const editor = read('v2', 'features', 'conversations', 'conversation', 'draft', 'DraftEditor.tsx');
  assert.match(editor, /\{ label: 'Try again', onPress: retry \}/);
});
