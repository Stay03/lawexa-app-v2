import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ToolMessage } from '@/types/chat';
import { runningSteps } from './running-steps';
import { createdQuiz } from './created-quiz';

/* A stored step with no result in a running turn is still running (backend,
 * 23 October 2026: the transcript has no step status; the conversation's
 * status says the turn runs). */

function step(patch: Partial<ToolMessage>): ToolMessage {
  return {
    id: 'm-1',
    role: 'tool',
    content: '',
    timestamp: new Date(0),
    toolName: 'create_quiz',
    toolParameters: {},
    toolStatus: 'complete',
    ...patch,
  } as ToolMessage;
}

test('in a running turn, a stored step with no result reads as making', () => {
  const waiting = step({});
  const [shown] = runningSteps([waiting], true);
  assert.equal(shown.toolStatus, 'calling');
  assert.deepEqual(createdQuiz(shown), { kind: 'making' });
});

test('a finished turn, a step with a result, or one with a result to fetch is left as it is', () => {
  const waiting = step({});
  const list = [waiting];
  assert.equal(runningSteps(list, false), list);
  const done = [step({ toolResult: { success: true, error: null, data: 'TEST DATA. Too short.' } })];
  assert.equal(runningSteps(done, true), done);
  const lazy = [step({ toolResult: { success: true, error: null, data: null }, resultRef: { messageId: 1, size: null } })];
  assert.equal(runningSteps(lazy, true), lazy);
});
