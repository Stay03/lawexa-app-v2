import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ToolMessage } from '@/types/chat';
import { createQuizStepAction, createdQuiz, createdQuizLine, quizCardSteps } from './created-quiz';

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

test('a refusal is told by its content: the sentence, even when the step reads success (backend, 23 October 2026)', () => {
  const sentence = 'TEST DATA. That document is too short to make a quiz from.';
  // A lazy list carries the sentence as the step's error, with no data.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: sentence, data: null } })), { kind: 'failed', message: sentence });
  // The fetched result is the bare sentence, and a reader below researcher sees success: true.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: sentence } })), { kind: 'failed', message: sentence });
  // A body that still carries { error: { message } } reads the same.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: false, error: null, data: { data: { error: { code: 'too_short', message: sentence } } } } })), { kind: 'failed', message: sentence });
});

test('a result not loaded yet is null, so the card asks for it rather than guessing', () => {
  assert.equal(createdQuiz(step({ toolResult: { success: true, error: null, data: null }, resultRef: { messageId: 1, size: null } })), null);
  // With no result to fetch, the run stopped: the card says so instead of loading for ever.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: null } })), { kind: 'failed', message: 'Lawexa stopped before the quiz was made. Ask again to try once more.' });
  assert.deepEqual(createdQuiz(step({})), { kind: 'failed', message: 'Lawexa stopped before the quiz was made. Ask again to try once more.' });
  // A body with no quiz and no sentence is a failure in the card's own words.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: { quiz: { title: 'No uuid' } } } })), { kind: 'failed', message: 'Lawexa could not make the quiz this time.' });
});

test('the step label says making, made, or could not make, never made above a refusal', () => {
  assert.equal(createQuizStepAction(false, undefined, false), 'Making a quiz');
  assert.equal(createQuizStepAction(true, { success: true, error: null, data: { quiz: { uuid: 'q-1', title: 'TEST DATA' } } }, false), 'Made a quiz');
  assert.equal(createQuizStepAction(true, { success: true, error: null, data: { data: { error: { code: 'too_short', message: 'TEST DATA. Too short.' } } } }, false), "Couldn't make a quiz");
  assert.equal(createQuizStepAction(true, { success: true, error: null, data: null }, true), 'Made a quiz');
});

test('a refused quiz step carries the error mark, with no Error line under it', () => {
  const item = readFileSync(join(here, 'ToolStepItem.tsx'), 'utf8');
  // From the LOADED result: a lazy chat's step has none of its own until fetched (shots5).
  assert.match(item, /const quizRefused = isCreateQuizStep\(message\) && createdQuiz\(loaded\.message\)\?\.kind === 'failed';/);
  assert.match(item, /isSuccess && !quizRefused \? 'success' : 'error'/);
  // No "Error:" line for a refused quiz, whatever the stored flag says: the card says it once.
  assert.match(item, /\{isError && !quizRefused && !isExpanded && \(/);
});

const NOTE_REFUSAL = "TEST DATA. You can't open that note, so a quiz can't be made from it.";
const ids = (steps: ToolMessage[]) => quizCardSteps(steps).map((s) => s.id);
/** A reopened chat's step before its result is fetched (`?results=lazy`): no data, a ref to fetch. */
const lazy = (id: string, messageId: number) => step({ id, toolResult: { success: true, error: null, data: null }, resultRef: { messageId, size: null } });
/** The same step once fetched: the refusal is the bare sentence, a made quiz is `data.quiz`. */
const fetchedRefusal = (id: string, sentence = NOTE_REFUSAL) => step({ id, toolResult: { success: true, error: null, data: sentence }, resultRef: { messageId: 1, size: null } });
const fetchedQuiz = (id: string) => step({ id, toolResult: { success: true, error: null, data: { quiz: { uuid: 'q-1', title: 'TEST DATA Election petitions' } } }, resultRef: { messageId: 2, size: null } });

test('a refusal shows no card when a later step in the answer made the quiz (Lucy, 24 October 2026)', () => {
  const refused = step({ id: 'm-1', toolResult: { success: true, error: NOTE_REFUSAL, data: null } });
  const made = step({ id: 'm-2', toolResult: { success: true, error: null, data: { quiz: { uuid: 'q-1', title: 'TEST DATA Election petitions' } } } });
  const making = step({ id: 'm-3', toolStatus: 'calling' });
  assert.deepEqual(ids([refused, made]), ['m-2']);
  // A later call still running, or a later result not fetched yet, may be the quiz: the refusal waits.
  assert.deepEqual(ids([refused, making]), ['m-3']);
  assert.deepEqual(ids([refused, lazy('m-4', 4)]), ['m-4']);
  // With no quiz made after it, a refusal stays and says why.
  const refusedAgain = step({ id: 'm-5', toolResult: { success: true, error: 'TEST DATA. That document is too short to make a quiz from.', data: null } });
  assert.deepEqual(ids([refused]), ['m-1']);
  assert.deepEqual(ids([refused, refusedAgain]), ['m-1', 'm-5']);
  // A refusal AFTER a made quiz has no later step that made good, so it keeps its card.
  assert.deepEqual(ids([made, refusedAgain]), ['m-2', 'm-5']);
  // Other tools never get a quiz card.
  assert.deepEqual(ids([step({ id: 'm-6', toolName: 'search_statutes' }), made]), ['m-2']);
});

test('in a reopened chat the rule waits for the loaded results, so no refusal shows above the quiz (Lucy, chat 8f58bf9b)', () => {
  // Nothing fetched yet: the first step waits (no card, so none appears and then goes); the last one draws its skeleton.
  assert.deepEqual(ids([lazy('m-1', 1), lazy('m-2', 2)]), ['m-2']);
  // The refusal has loaded, the quiz has not: still hidden.
  assert.deepEqual(ids([fetchedRefusal('m-1'), lazy('m-2', 2)]), ['m-2']);
  // Both loaded, the later one made the quiz: only the quiz.
  assert.deepEqual(ids([fetchedRefusal('m-1'), fetchedQuiz('m-2')]), ['m-2']);
  // The later step loads as refused too: both refusals show, each with its reason.
  assert.deepEqual(ids([fetchedRefusal('m-1'), fetchedRefusal('m-2', 'TEST DATA. Too short.')]), ['m-1', 'm-2']);
  // A lone step always has its card, loaded or not.
  assert.deepEqual(ids([lazy('m-1', 1)]), ['m-1']);
});

test('the cards read every quiz step loaded, through the same cache the card reads', () => {
  const list = readFileSync(join(here, '..', 'MessageList.tsx'), 'utf8');
  assert.match(list, /<CompactToolChain messages=\{steps\} \/>\s*<CreatedQuizCards steps=\{steps\} \/>/);
  const cards = readFileSync(join(here, '..', 'cards', 'CreatedQuizCard.tsx'), 'utf8');
  assert.match(cards, /const loaded = useToolResults\(quizSteps\);\s*return quizCardSteps\(loaded\)\.map\(\(step\) => <CreatedQuizCard key=\{step\.id\} message=\{step\} \/>\);/);
  const hook = readFileSync(join(here, 'use-tool-result.ts'), 'utf8');
  // One query shape for one step and for many, so the key is the same and nothing is fetched twice.
  assert.match(hook, /const \{ needed, options \} = toolResultQuery\(conversationId, message, enabled\);\s*const query = useQuery\(options\);/);
  assert.match(hook, /const queries = useQueries\(\{ queries: built\.map\(\(\{ options \}\) => options\) \}\);/);
  assert.match(hook, /queryKey: \['tool-result', conversationId, ref\?\.messageId\] as const,/);
});

test('the card sits after the step chain, and Edit opens the quiz page with its form', () => {
  const card = readFileSync(join(here, '..', 'cards', 'CreatedQuizCard.tsx'), 'utf8');
  assert.match(card, /href=\{`\$\{quizFrontHref\(state\.uuid\)\}\?edit=1`\}/);
  const front = readFileSync(join(here, '..', '..', '..', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx'), 'utf8');
  assert.match(front, /if \(wantsEdit && own && !editAdopted\) \{/);
  assert.match(front, /if \(!next && wantsEdit\) replaceUrlParams\(\{ edit: null \}\);/);
});
