import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ToolMessage } from '@/types/chat';
import { createdQuiz, createdQuizLine } from './created-quiz';

/* Quiz from a source, door 1 (Stay, 23 October 2026): Lawexa's create_quiz
 * step shows the quiz as a card under the answer. Shape from backend
 * (bb81d318, 210d4c96). */

const here = dirname(fileURLToPath(import.meta.url));

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

test('a running step is "making"; another tool is not this card', () => {
  assert.deepEqual(createdQuiz(step({ toolStatus: 'calling' })), { kind: 'making' });
  assert.equal(createdQuiz(step({ toolName: 'create_note' })), null);
});

test('a made quiz reads its title, counts and source, with a statute part range', () => {
  const quiz = createdQuiz(
    step({
      toolResult: {
        success: true,
        error: null,
        data: { quiz: { uuid: 'q-1', title: 'TEST DATA Tenancy Law', question_count: 10, scenario_count: 1, visibility: 'private', source: { kind: 'statute', title: 'TEST DATA Recovery of Premises Law', range: 'Part II to Part III' } } },
      },
    }),
  );
  assert.deepEqual(quiz, { kind: 'ready', uuid: 'q-1', title: 'TEST DATA Tenancy Law', questionCount: 10, scenarioCount: 1, source: 'TEST DATA Recovery of Premises Law, Part II to Part III' });
  if (quiz?.kind !== 'ready') throw new Error('not ready');
  assert.equal(createdQuizLine(quiz), '10 questions · 1 scenario · from TEST DATA Recovery of Premises Law, Part II to Part III');
  assert.equal(createdQuizLine({ ...quiz, questionCount: 1, scenarioCount: 0, source: null }), '1 question');
});

test('a refusal shows the server\'s own sentence, and a stored result wrapped in data reads the same', () => {
  const failed = createdQuiz(step({ toolResult: { success: false, error: null, data: { data: { error: { code: 'too_short', message: 'TEST DATA. That document is too short to make a quiz from.' } } } } }));
  assert.deepEqual(failed, { kind: 'failed', message: 'TEST DATA. That document is too short to make a quiz from.' });
  assert.deepEqual(createdQuiz(step({ toolResult: { success: false, error: 'Rate limited', data: null } })), { kind: 'failed', message: 'Rate limited' });
});

test('an unknown or not-yet-loaded result is null, so the card waits rather than guessing', () => {
  assert.equal(createdQuiz(step({ toolResult: { success: true, error: null, data: null } })), null);
  assert.equal(createdQuiz(step({ toolResult: { success: true, error: null, data: { quiz: { title: 'No uuid' } } } })), null);
});

test('the card sits after the step chain, and Edit opens the quiz page with its form', () => {
  const list = readFileSync(join(here, '..', 'MessageList.tsx'), 'utf8');
  assert.match(list, /<CompactToolChain messages=\{group\.messages\} \/>\s*\{quizSteps\.map\(\(step\) => \(\s*<CreatedQuizCard key=\{step\.id\} message=\{step\} \/>/);
  const card = readFileSync(join(here, '..', 'cards', 'CreatedQuizCard.tsx'), 'utf8');
  assert.match(card, /href=\{`\$\{quizFrontHref\(state\.uuid\)\}\?edit=1`\}/);
  const front = readFileSync(join(here, '..', '..', '..', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx'), 'utf8');
  assert.match(front, /if \(wantsEdit && own && !editAdopted\) \{/);
  assert.match(front, /if \(!next && wantsEdit\) replaceUrlParams\(\{ edit: null \}\);/);
});
