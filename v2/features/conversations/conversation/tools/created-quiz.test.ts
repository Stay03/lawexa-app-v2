import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ToolMessage } from '@/types/chat';
import {
  QUIZ_TRANSPORT_FAILURE,
  createQuizStepAction,
  createdQuiz,
  createdQuizLine,
  quizCards,
  quizJobFinished,
  quizJobState,
  quizStepLabel,
  quizStepState,
  refusedLine,
  type QuizJobRef,
} from './created-quiz';

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

test('a refusal is stored whole with data.error and shown in its own words; anything else is a transport failure (backend, 24 October 2026)', () => {
  const sentence = 'TEST DATA. That document is too short to make a quiz from.';
  // The refusal, as the fetched result carries it (wrapped or not).
  assert.deepEqual(createdQuiz(step({ toolResult: { success: false, error: null, data: { data: { error: { code: 'too_short', message: sentence } } } } })), { kind: 'failed', message: sentence });
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: { success: false, error: { code: 'no_access', message: sentence } } } })), { kind: 'failed', message: sentence });
  // A lazy row's error is only ever a transport failure (refusals and jobs carry none): never its words.
  const masked = 'That lookup found nothing, so Lawexa tried another way.';
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: masked, data: null }, resultRef: { messageId: 96, size: 8 } })), { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE });
  // The masked message as the fetched result, read as success: true on purpose.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: { message: masked } } })), { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE });
  // A bare text result.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: sentence } })), { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE });
});

test('a result not loaded yet is null, so the card asks for it rather than guessing', () => {
  assert.equal(createdQuiz(step({ toolResult: { success: true, error: null, data: null }, resultRef: { messageId: 1, size: null } })), null);
  // With no result to fetch, the run stopped: the card says so instead of loading for ever.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: null } })), { kind: 'failed', message: 'Lawexa stopped before the quiz was made. Ask again to try once more.' });
  assert.deepEqual(createdQuiz(step({})), { kind: 'failed', message: 'Lawexa stopped before the quiz was made. Ask again to try once more.' });
  // A body with no quiz and no refusal is a failure in the card's own words.
  assert.deepEqual(createdQuiz(step({ toolResult: { success: true, error: null, data: { quiz: { title: 'No uuid' } } } })), { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE });
});

test('the step label says making, made, or could not make, never made above a refusal', () => {
  assert.equal(createQuizStepAction(false, undefined, false), 'Making a quiz');
  assert.equal(createQuizStepAction(true, { success: true, error: null, data: { quiz: { uuid: 'q-1', title: 'TEST DATA', question_count: 10 } } }, false), 'Made a quiz');
  // The quiz builder starts a quiz with no questions: they come in the steps after.
  assert.equal(createQuizStepAction(true, { success: true, error: null, data: { quiz: { uuid: 'q-1', title: 'TEST DATA', question_count: 0 } } }, false), 'Started a quiz');
  assert.equal(createQuizStepAction(true, { success: true, error: null, data: { data: { error: { code: 'too_short', message: 'TEST DATA. Too short.' } } } }, false), "Couldn't make a quiz");
  // Not loaded yet: a lazy row carries neither the job nor the quiz, so it says only what is sure.
  assert.equal(createQuizStepAction(true, { success: true, error: null, data: null }, true), 'Started a quiz');
  // A lazy row with an error is a transport failure.
  assert.equal(createQuizStepAction(true, { success: true, error: 'That lookup found nothing, so Lawexa tried another way.', data: null }, true), "Couldn't make a quiz");
});

test('a refused quiz step carries the error mark, with no Error line under it', () => {
  const item = readFileSync(join(here, 'ToolStepItem.tsx'), 'utf8');
  // From the LOADED result: a lazy chat's step has none of its own until fetched (shots5).
  assert.match(item, /const quizRefused = isQuizStep\(message\) && quizStepState\(loaded\.message\)\?\.kind === 'failed';/);
  assert.match(item, /isSuccess && !quizRefused \? 'success' : 'error'/);
  // No "Error:" line for a refused quiz, whatever the stored flag says: the card says it once.
  assert.match(item, /\{isError && !quizRefused && !isExpanded && \(/);
});

const NOTE_REFUSAL = "TEST DATA. You can't open that note, so a quiz can't be made from it.";
const ids = (steps: ToolMessage[]) => quizCards(steps).map((entry) => entry.step.id);
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
  assert.match(cards, /const quizSteps = steps\.filter\(isQuizCardStep\);\s*const loaded = useToolResults\(quizSteps\);\s*return quizCards\(loaded\)\.map\(\(entry\) => <CreatedQuizCard key=\{entry\.key\} message=\{entry\.step\} refused=\{entry\.refused\} \/>\);/);
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

/* A quiz still being made (backend, 24 October 2026): create_quiz returns at
 * once with data.quiz_job, and the card asks GET /quiz-jobs/{uuid}. */

const JOB_RESULT = {
  success: true,
  error: null,
  data: {
    quiz_job: { uuid: 'j-1', status: 'reading', question_count: 10, source: { kind: 'statute', title: 'TEST DATA Labour Act, 1974', range: 'Part II' } },
  },
};
const REF: QuizJobRef = { uuid: 'j-1', questionCount: 10, source: 'TEST DATA Labour Act, 1974, Part II' };

test('a step that left a job is a quiz being made, with its count and source, and reads "Started a quiz"', () => {
  assert.deepEqual(createdQuiz(step({ toolResult: JOB_RESULT })), { kind: 'job', job: REF });
  assert.equal(createQuizStepAction(true, JOB_RESULT, false), 'Started a quiz');
  // A job with no source still makes a card.
  const bare = { success: true, error: null, data: { quiz_job: { uuid: 'j-2', status: 'reading' } } };
  assert.deepEqual(createdQuiz(step({ toolResult: bare })), { kind: 'job', job: { uuid: 'j-2', questionCount: 0, source: null } });
});

test('a polled job is making until done, then the made quiz with the step source, or the job sentence', () => {
  assert.deepEqual(quizJobState(null, REF), { kind: 'making' });
  assert.deepEqual(quizJobState({ status: 'reading' }, REF), { kind: 'making' });
  assert.deepEqual(quizJobState({ status: 'writing' }, REF), { kind: 'making' });
  assert.deepEqual(
    quizJobState({ status: 'done', quiz_uuid: 'q-9', quiz: { uuid: 'q-9', title: 'TEST DATA Labour Act Part II', question_count: 10, scenario_count: 1 } }, REF),
    { kind: 'ready', uuid: 'q-9', title: 'TEST DATA Labour Act Part II', questionCount: 10, scenarioCount: 1, source: 'TEST DATA Labour Act, 1974, Part II' },
  );
  // Done, sent without the quiz: still the quiz, from the job's own fields.
  assert.deepEqual(quizJobState({ status: 'done', quiz_uuid: 'q-9', quiz: null }, REF), {
    kind: 'ready',
    uuid: 'q-9',
    title: 'Your quiz',
    questionCount: 10,
    scenarioCount: 0,
    source: 'TEST DATA Labour Act, 1974, Part II',
  });
  const late = 'The quiz could not be written just now. Try again in a moment.';
  assert.deepEqual(quizJobState({ status: 'failed', error: { code: 'failed', message: late } }, REF), { kind: 'failed', message: late });
  assert.deepEqual(quizJobState({ status: 'failed', error: null }, REF), { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE });
  assert.equal(quizJobFinished({ status: 'done' }), true);
  assert.equal(quizJobFinished({ status: 'failed' }), true);
  assert.equal(quizJobFinished({ status: 'writing' }), false);
  assert.equal(quizJobFinished(null), false);
});

test('a quiz with fewer questions than asked says so: "8 of the 10 questions asked" (backend, 24 October 2026)', () => {
  const short = quizJobState(
    { status: 'done', question_count: 10, quiz: { uuid: 'q-8', title: 'TEST DATA Labour Act Part II', question_count: 8, scenario_count: 0 } },
    REF,
  );
  assert.deepEqual(short, {
    kind: 'ready',
    uuid: 'q-8',
    title: 'TEST DATA Labour Act Part II',
    questionCount: 8,
    scenarioCount: 0,
    source: 'TEST DATA Labour Act, 1974, Part II',
    asked: 10,
  });
  if (short.kind !== 'ready') throw new Error('not ready');
  assert.equal(createdQuizLine(short), '8 of the 10 questions asked · from TEST DATA Labour Act, 1974, Part II');
  // The job without its own count falls back to the step's.
  const fromStep = quizJobState({ status: 'done', quiz: { uuid: 'q-8', title: 'T', question_count: 8 } }, REF);
  assert.equal(fromStep.kind === 'ready' ? fromStep.asked : null, 10);
  // As many as asked: the plain count, no "asked".
  const full = quizJobState({ status: 'done', question_count: 10, quiz: { uuid: 'q-9', title: 'T', question_count: 10 } }, REF);
  assert.equal(full.kind === 'ready' ? 'asked' in full : null, false);
  assert.equal(full.kind === 'ready' ? createdQuizLine(full) : '', '10 questions · from TEST DATA Labour Act, 1974, Part II');
});

test('a bare transport error shows the plain sentence, never the code, in the card and the step', () => {
  for (const raw of ['HTTP 500', 'HTTP 504 Gateway Timeout', '500', 'Request failed with status code 500', 'Network Error', 'timeout of 30000ms exceeded', 'Internal Server Error']) {
    const result = { success: false, error: raw, data: null };
    assert.deepEqual(createdQuiz(step({ toolResult: result })), { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE }, raw);
    assert.equal(createQuizStepAction(true, result, false), "Couldn't make a quiz", raw);
  }
  assert.deepEqual(quizJobState({ status: 'failed', error: { code: 'failed', message: 'HTTP 500' } }, REF), { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE });
  // A real refusal (stored whole, with data.error) keeps its own words.
  const refusal = 'TEST DATA. A quiz is already being made for you. Wait for it to finish, then ask again.';
  assert.deepEqual(createdQuiz(step({ toolResult: { success: false, error: null, data: { success: false, error: { code: 'limit', message: refusal } } } })), { kind: 'failed', message: refusal });
});

test('a quiz being made counts as maybe made, so an earlier refusal waits for it', () => {
  const refused = step({ id: 'm-1', toolResult: { success: true, error: NOTE_REFUSAL, data: null } });
  const job = step({ id: 'm-2', toolResult: JOB_RESULT });
  assert.deepEqual(ids([refused, job]), ['m-2']);
});

test('the job is asked every 4 s until it is done, failed or gone, and not while the tab is hidden', () => {
  const hook = readFileSync(join(here, 'use-quiz-job.ts'), 'utf8');
  assert.match(hook, /export const QUIZ_JOB_POLL_MS = 4_000;/);
  assert.match(hook, /apiClient\.get<\{ data\?: \{ job\?: unknown \} \}>\(`\/quiz-jobs\/\$\{encodeURIComponent\(uuid\)\}`\)/);
  assert.match(hook, /quizJobFinished\(query\.state\.data\) \|\| statusOf\(query\.state\.error\) === 404 \? false : QUIZ_JOB_POLL_MS/);
  assert.match(hook, /refetchIntervalInBackground: false,/);
  const card = readFileSync(join(here, '..', 'cards', 'CreatedQuizCard.tsx'), 'utf8');
  assert.match(card, /if \(state\.kind === 'job'\) return <QuizJobCard job=\{state\.job\} \/>;/);
  assert.match(card, /const query = useQuizJob\(job\.uuid\);/);
});

/* Lawexa builds the quiz itself (Stay, 24 October 2026, "one version"):
 * create_quiz starts it, add_to_quiz and edit_quiz grow and change it,
 * read_quiz reads it back. Shape from backend, 24 October 2026. */

const QUIZ = (count: number, scenarios = 0) => ({ uuid: 'q-7', title: 'TEST DATA Contract law basics', question_count: count, scenario_count: scenarios, visibility: 'private', url: '/quiz/q-7' });
const built = (id: string, toolName: string, data: Record<string, unknown>) =>
  step({ id, toolName, toolResult: { success: true, error: null, data: { success: true, message: '', data } } });

test('one card per quiz: it is drawn from the latest step, at the place of the first', () => {
  const started = built('m-1', 'create_quiz', { quiz: QUIZ(0) });
  const added = built('m-2', 'add_to_quiz', { quiz: QUIZ(5, 1), added: { questions: 5, scenarios: 1 }, refused: [] });
  const addedMore = built('m-3', 'add_to_quiz', { quiz: QUIZ(8, 1), added: { questions: 3, scenarios: 0 }, refused: [] });
  const read = built('m-4', 'read_quiz', { quiz: QUIZ(8, 1), items: [] });
  const cards = quizCards([started, added, read, addedMore]);
  assert.equal(cards.length, 1, 'one quiz, one card; a read has none of its own');
  assert.equal(cards[0].key, 'quiz:q-7');
  assert.equal(cards[0].step.id, 'm-3');
  const state = quizStepState(cards[0].step);
  assert.equal(state?.kind === 'ready' ? createdQuizLine(state) : '', '8 questions · 1 scenario');
  // Just started: no questions yet.
  const fresh = quizStepState(started);
  assert.equal(fresh?.kind === 'ready' ? createdQuizLine(fresh) : '', 'No questions yet');
  // Two quizzes in one answer keep two cards.
  const other = built('m-5', 'create_quiz', { quiz: { ...QUIZ(0), uuid: 'q-8', title: 'TEST DATA Tort' } });
  assert.deepEqual(quizCards([started, other, added]).map((entry) => entry.key), ['quiz:q-7', 'quiz:q-8']);
});

test('an edit in a later chat draws the card there too', () => {
  const edited = built('m-1', 'edit_quiz', { quiz: QUIZ(7, 1), changed: { updated: 2, removed: 1 }, refused: [] });
  assert.deepEqual(ids([edited]), ['m-1']);
  assert.deepEqual(quizStepLabel('edit_quiz', true, edited.toolResult, false), { action: 'Edited the quiz', title: 'TEST DATA Contract law basics' });
});

test('items refused while the rest are saved are said on the card, gathered over the quiz’s steps', () => {
  const reason = 'TEST DATA. The answer is not one of its options.';
  const first = built('m-1', 'add_to_quiz', { quiz: QUIZ(4), added: { questions: 4, scenarios: 0 }, refused: [{ index: 4, item: 'question', reason }] });
  const second = built('m-2', 'add_to_quiz', { quiz: QUIZ(6), added: { questions: 2, scenarios: 0 }, refused: [{ index: 0, item: 'question', reason }] });
  const [card] = quizCards([first, second]);
  assert.equal(card.refused.length, 2);
  assert.equal(refusedLine(card.refused), "2 questions weren't saved");
  assert.equal(refusedLine(quizCards([first])[0].refused), `1 question wasn't saved: ${reason}`);
  assert.equal(refusedLine([{ item: 'question', reason }, { item: 'scenario', reason }]), "2 items weren't saved");
  assert.equal(refusedLine([]), null);
  // A malformed row is skipped, never shown as a blank reason.
  assert.equal(quizCards([built('m-3', 'add_to_quiz', { quiz: QUIZ(1), refused: [{ index: 0 }] })])[0].refused.length, 0);
});

test('each step names what it did, from its loaded result', () => {
  const add = (added: unknown) => ({ success: true, error: null, data: { data: { quiz: QUIZ(5), added } } });
  assert.deepEqual(quizStepLabel('add_to_quiz', false, undefined, false), { action: 'Adding to the quiz', title: null });
  assert.equal(quizStepLabel('add_to_quiz', true, add({ questions: 5, scenarios: 1 }), false).action, 'Added 5 questions and 1 scenario');
  assert.equal(quizStepLabel('add_to_quiz', true, add({ questions: 1, scenarios: 0 }), false).action, 'Added 1 question');
  assert.equal(quizStepLabel('add_to_quiz', true, add({ questions: 0, scenarios: 2 }), false).action, 'Added 2 scenarios');
  assert.equal(quizStepLabel('add_to_quiz', true, add({ questions: 0, scenarios: 0 }), false).action, 'Added nothing to the quiz');
  // Not loaded yet: what it did, true whatever the result.
  assert.equal(quizStepLabel('add_to_quiz', true, { success: true, error: null, data: null }, true).action, 'Added to the quiz');
  assert.equal(quizStepLabel('read_quiz', true, { success: true, error: null, data: { quiz: QUIZ(5), items: [] } }, false).action, 'Read the quiz');
  assert.equal(quizStepLabel('create_quiz', true, { success: true, error: null, data: { quiz: QUIZ(0) } }, false).action, 'Started a quiz');
});

test('a whole refusal (no access, not found, not yours) shows its own sentence, and a later good step hides it', () => {
  const sentence = 'TEST DATA. That quiz is not yours to change.';
  const refused = step({ id: 'm-1', toolName: 'edit_quiz', toolResult: { success: false, error: null, data: { success: false, message: '', data: { error: { code: 'not_yours', message: sentence } } } } });
  assert.deepEqual(quizStepState(refused), { kind: 'failed', message: sentence });
  assert.equal(quizStepLabel('edit_quiz', true, refused.toolResult, false).action, "Couldn't edit the quiz");
  assert.equal(quizStepLabel('add_to_quiz', true, refused.toolResult, false).action, "Couldn't add to the quiz");
  assert.equal(quizStepLabel('read_quiz', true, refused.toolResult, false).action, "Couldn't read the quiz");
  assert.deepEqual(ids([refused]), ['m-1']);
  const good = built('m-2', 'edit_quiz', { quiz: QUIZ(5), changed: { updated: 1, removed: 0 }, refused: [] });
  assert.deepEqual(ids([refused, good]), ['m-2']);
  // An add still running shows no card of its own and hides nothing it cannot answer for.
  assert.equal(quizStepState(step({ id: 'm-3', toolName: 'add_to_quiz', toolStatus: 'calling' })), null);
});

test('the step row reads every quiz step, and its refused mark follows the card', () => {
  const item = readFileSync(join(here, 'ToolStepItem.tsx'), 'utf8');
  assert.match(item, /case 'create_quiz':\s*case 'add_to_quiz':\s*case 'edit_quiz':\s*case 'read_quiz': \{\s*const \{ action, title \} = quizStepLabel\(toolName, isComplete, toolResult, hasResultRef\);/);
  const card = readFileSync(join(here, '..', 'cards', 'CreatedQuizCard.tsx'), 'utf8');
  assert.match(card, /<p className="text-xs font-medium text-muted-foreground">Quiz · in My quizzes<\/p>/);
  assert.match(card, /const notSaved = refusedLine\(refused\);/);
});

test('an add not loaded yet after a drawn card waits, so no skeleton shows beside the card and then goes', () => {
  const started = built('m-1', 'create_quiz', { quiz: QUIZ(0) });
  const pending = step({ id: 'm-2', toolName: 'add_to_quiz', toolResult: { success: true, error: null, data: null }, resultRef: { messageId: 9, size: null } });
  assert.deepEqual(ids([started, pending]), ['m-1']);
  // Alone, a step not loaded yet still draws its skeleton.
  assert.deepEqual(ids([pending]), ['m-2']);
});
