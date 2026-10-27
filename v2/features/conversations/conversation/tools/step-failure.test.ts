import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ToolMessage } from '@/types/chat';
import {
  GENERIC_STEP_FAILURE,
  SOFTENED_LOOKUP_MISS,
  STEP_DID_NOT_WORK,
  STEP_NOT_FOUND,
  failedStepLine,
  failedStepOutcome,
  failedStepSentence,
  stepFailed,
} from './step-failure';

/* A failed step in plain words (Stay, 27 October 2026, thread 9978b59a, option
 * A): never Lawexa's own error text, never red. TEST DATA throughout. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const code = (...parts: string[]) =>
  read(...parts).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const TOOLS = ['v2', 'features', 'conversations', 'conversation', 'tools'];

/** The error Lucy saw in a Space chat at 21:52Z, 26 October 2026. */
const STATUTE_MISS = 'No statute matches that id, slug or title. Find it with search_statutes and pass its id.';

const streamed = (toolName: string, error: string): ToolMessage =>
  ({ role: 'tool', toolName, toolParameters: {}, toolStatus: 'complete', toolResult: { success: false, data: null, error } }) as ToolMessage;

/** The same failure in a reloaded chat: a stored tool call and its failed result. */
function replayed(toolName: string, content: string): ToolMessage {
  const at = '2026-10-27T01:00:00Z';
  const messages: ApiMessage[] = [
    {
      id: 1, conversation_id: 'c1', agent_id: null, role: 'assistant', content: '',
      metadata: { type: 'tool_call', tool_name: toolName, tool_parameters: {}, iteration: 1 }, created_at: at,
    },
    {
      id: 2, conversation_id: 'c1', agent_id: null, role: 'tool', content,
      metadata: { type: 'tool_result', iteration: 1, success: false, latency_ms: 40 }, created_at: at,
    },
  ];
  return transformApiMessages(messages).find((message): message is ToolMessage => message.role === 'tool')!;
}

test('a failure that says the thing is not there reads "not found"; anything else "didn’t work this time"', () => {
  for (const error of [STATUTE_MISS, 'Case not found.', 'That note does not exist.', "Couldn't find that file.", 'No such quiz.']) {
    assert.equal(failedStepOutcome(streamed('read_statute', error)), STEP_NOT_FOUND, error);
  }
  for (const error of ['Service busy. Try again.', 'Timeout after 30s', 'Internal error', '']) {
    assert.equal(failedStepOutcome(streamed('search_cases', error)), STEP_DID_NOT_WORK, error);
  }
});

test('a streamed step and the same step in a reloaded chat read the same', () => {
  const live = streamed('read_statute', STATUTE_MISS);
  const reloaded = replayed('read_statute', STATUTE_MISS);
  assert.equal(failedStepOutcome(reloaded), STEP_NOT_FOUND);
  assert.deepEqual(
    failedStepLine(reloaded, { action: 'Read Statute' }),
    failedStepLine(live, { action: 'Read Statute' }),
  );
  const stored = replayed('search_cases', JSON.stringify({ success: false, message: 'Service busy.' }));
  assert.equal(failedStepOutcome(stored), STEP_DID_NOT_WORK);
});

test('a read that found nothing says what it looked for; other steps keep their label', () => {
  assert.deepEqual(failedStepLine(streamed('read_statute', STATUTE_MISS), { action: 'Read Statute' }), {
    action: 'Looked for a statute',
    outcome: STEP_NOT_FOUND,
  });
  assert.deepEqual(failedStepLine(streamed('view_case', 'Case not found.'), { action: 'Read case', detail: '#41' }), {
    action: 'Looked for a case',
    outcome: STEP_NOT_FOUND,
  });
  // A read that failed for another reason keeps its label.
  assert.deepEqual(failedStepLine(streamed('view_case', 'Service busy.'), { action: 'Read case', detail: '#41' }), {
    action: 'Read case',
    detail: '#41',
    outcome: STEP_DID_NOT_WORK,
  });
  assert.deepEqual(
    failedStepLine(streamed('search_cases', 'Service busy.'), { action: 'Searched cases', detail: 'for "TEST DATA tenancy"' }),
    { action: 'Searched cases', detail: 'for "TEST DATA tenancy"', outcome: STEP_DID_NOT_WORK },
  );
});

test('a tool with no label of its own says "A step didn’t work"', () => {
  const line = failedStepLine(streamed('reindex_widgets', 'Exception in handler'), { action: 'Reindex Widgets', generic: true });
  assert.deepEqual(line, { action: GENERIC_STEP_FAILURE, outcome: null });
  const step = code(...TOOLS, 'ToolStepItem.tsx');
  assert.match(step, /action: isComplete \? readable : `\$\{readable\}\.\.\.`,\s*generic: true,/);
});

test('the server’s softened "found nothing", sent as a success, reads as not found', () => {
  // What a reader below researcher gets on live (d5045bf8): a success carrying this sentence.
  const softened = (toolResult: ToolMessage['toolResult']): ToolMessage =>
    ({ role: 'tool', toolName: 'read_statute', toolParameters: { section: '13' }, toolStatus: 'complete', toolResult }) as ToolMessage;
  // A lazy row, before its result is fetched: the sentence rides on `error`.
  const lazy = softened({ success: true, data: null, error: SOFTENED_LOOKUP_MISS });
  // The fetched result: the sentence is the JSON's `message`.
  const loaded = softened({ success: true, data: { message: SOFTENED_LOOKUP_MISS }, error: null });
  for (const step of [lazy, loaded]) {
    assert.equal(stepFailed(step), true);
    assert.deepEqual(failedStepLine(step, { action: 'Read section 13' }), { action: 'Looked for a statute', outcome: STEP_NOT_FOUND });
    assert.equal(failedStepSentence(step), 'Lawexa looked for this and it was not there.');
  }
  // The same sentence on a reloaded chat, through the app's own reading of the stored row.
  const reloaded = replayed('read_statute', JSON.stringify({ message: SOFTENED_LOOKUP_MISS }));
  assert.equal(stepFailed({ ...reloaded, toolResult: { ...reloaded.toolResult!, success: true } }), true);
  // A real success, and a step still running, are not failures.
  assert.equal(stepFailed(softened({ success: true, data: { message: 'Section 13 read.' }, error: null })), false);
  assert.equal(stepFailed({ ...lazy, toolStatus: 'calling' }), false);
  // Both step views read failure through the one check.
  assert.match(code(...TOOLS, 'ToolStepItem.tsx'), /const isError = stepFailed\(loaded\.message\);\s*const isSuccess = isComplete && !isError;/);
  assert.match(code(...TOOLS, 'ToolCallDetails.tsx'), /const success = !stepFailed\(message\);/);
});

test('an opened failed step says it in a sentence, not the error', () => {
  assert.equal(failedStepSentence(streamed('read_statute', STATUTE_MISS)), 'Lawexa looked for this and it was not there.');
  assert.equal(failedStepSentence(streamed('search_cases', 'Service busy.')), "This step didn't work this time.");
});

test('no step view shows the error text or turns red', () => {
  const step = code(...TOOLS, 'ToolStepItem.tsx');
  assert.doesNotMatch(step, /extractStepError|Error: \{|Unknown error|destructive/);
  assert.match(step, /const failure = isError && !quizRefused \? failedStepLine\(loaded\.message, label\) : null;/);
  assert.match(step, /\{failure\?\.outcome && \(\s*<span className="text-muted-foreground font-normal"> · \{failure\.outcome\}<\/span>/);
  const details = code(...TOOLS, 'ToolCallDetails.tsx');
  assert.doesNotMatch(details, /extractStepError|tone="error"|destructive/);
  assert.match(details, /\{isComplete && !success && <ToolEmptyLine>\{failedStepSentence\(message\)\}<\/ToolEmptyLine>\}/);
  assert.doesNotMatch(code(...TOOLS, 'ToolResultParts.tsx'), /text-destructive|XCircle/);
});
