import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChannelQuiz } from '@/types/channel-quiz';
import {
  addToScenario,
  draftsFromQuiz,
  findFormProblem,
  groupQuestions,
  hasFormContent,
  newQuestion,
  newScenario,
  toPayload,
  validate,
  type QuestionDraft,
} from './form-model';

/* Quiz piece 4 (Stay, 23 October 2026, picture 6): the library's form has a
 * scenario box, and a scenario's questions stay together. */

const here = dirname(fileURLToPath(import.meta.url));

function filled(question: QuestionDraft, text: string): QuestionDraft {
  const options = question.options.map((option, index) => ({ ...option, content: index === 0 ? 'Yes' : 'No' }));
  return { ...question, question: text, options, correctKey: options[0].key };
}

test('the payload sends scenarios in the order they first appear, and each question points into that order', () => {
  const plot = { ...newScenario(), title: '  The right of way  ', passage: 'TEST DATA. Ada owns Plot 14.' };
  const covenant = { ...newScenario(), passage: 'TEST DATA. A covenant binds the land.' };
  const questions = [
    filled(newQuestion(), 'Q1'),
    filled(newQuestion(covenant.key), 'Q2'),
    filled(newQuestion(plot.key), 'Q3'),
    filled(newQuestion(plot.key), 'Q4'),
  ];
  const payload = toPayload(questions, [plot, covenant]);
  assert.deepEqual(payload.scenarios, [{ passage: 'TEST DATA. A covenant binds the land.' }, { title: 'The right of way', passage: 'TEST DATA. Ada owns Plot 14.' }]);
  assert.deepEqual(payload.questions.map((q) => q.scenario_index), [undefined, 0, 1, 1]);
  assert.equal('scenario_index' in payload.questions[0], false);
});

test('a scenario nobody uses is not sent, and an unused scenario is not checked', () => {
  const unused = newScenario();
  const questions = [filled(newQuestion(), 'Q1')];
  assert.deepEqual(toPayload(questions, [unused]).scenarios, []);
  assert.equal(validate('TEST DATA quiz', questions, [unused]), null);
});

test('a used scenario needs its passage', () => {
  const scenario = newScenario();
  const questions = [filled(newQuestion(scenario.key), 'Q1')];
  assert.equal(validate('TEST DATA quiz', questions, [scenario]), 'Scenario 1 needs its passage.');
  assert.equal(validate('TEST DATA quiz', questions, [{ ...scenario, passage: 'TEST DATA facts.' }]), null);
});

test('a question added to a scenario goes right after its set, so the set stays together', () => {
  const a = newScenario();
  const b = newScenario();
  const list = [newQuestion(a.key), newQuestion(b.key), newQuestion()];
  const next = addToScenario(list, a.key);
  assert.deepEqual(next.map((q) => q.scenarioKey), [a.key, a.key, b.key, null]);
  const groups = groupQuestions(next, [a, b]);
  assert.deepEqual(groups.map((g) => (g.kind === 'scenario' ? `${g.kind}:${g.questions.length}@${g.start}` : `${g.kind}@${g.start}`)), ['scenario:2@0', 'scenario:1@2', 'question@3']);
});

test('a saved quiz loads with its scenarios, each question still pointing at its own', () => {
  const quiz = {
    scenarios: [
      { uuid: 's-b', title: null, passage: 'Second', position: 2 },
      { uuid: 's-a', title: 'First', passage: 'First passage', position: 1 },
    ],
    questions: [
      { type: 'multiple_choice', question: 'Q2', time_limit_seconds: 20, position: 2, scenario_uuid: 's-a', options: [{ content: 'A', is_correct: true }, { content: 'B', is_correct: false }] },
      { type: 'multiple_choice', question: 'Q1', time_limit_seconds: 20, position: 1, scenario_uuid: null, options: [{ content: 'A', is_correct: false }, { content: 'B', is_correct: true }] },
    ],
  } as unknown as ChannelQuiz;
  const drafts = draftsFromQuiz(quiz);
  assert.deepEqual(drafts.scenarios.map((s) => [s.title, s.passage]), [['First', 'First passage'], ['', 'Second']]);
  assert.deepEqual(drafts.questions.map((q) => q.question), ['Q1', 'Q2']);
  assert.equal(drafts.questions[0].scenarioKey, null);
  assert.equal(drafts.questions[1].scenarioKey, drafts.scenarios[0].key);
  // And it saves back the same way.
  const payload = toPayload(drafts.questions, drafts.scenarios);
  // With its uuid, so the server keeps whatever it stored on it (its source).
  assert.deepEqual(payload.scenarios, [{ uuid: 's-a', title: 'First', passage: 'First passage' }]);
  assert.equal(payload.questions[1].scenario_index, 0);
});

test('a new question starts at 30 seconds, and every question sends its own time', () => {
  // Arthur, 26 October 2026: 5 to 60 seconds, 30 by default.
  assert.equal(newQuestion().seconds, 30);
  const question = newQuestion();
  question.question = 'TEST DATA. Is a lease an interest in land?';
  question.options = question.options.map((option, index) => ({ ...option, content: index === 0 ? 'Yes' : 'No' }));
  question.correctKey = question.options[0].key;
  assert.equal(toPayload([question], []).questions[0].time_limit_seconds, 30);
  // A stored question keeps its own time.
  const loaded = draftsFromQuiz({
    questions: [{ type: 'true_false', question: 'TEST DATA', time_limit_seconds: 45, position: 0, scenario_uuid: null, options: [{ content: 'True', is_correct: true }, { content: 'False', is_correct: false }] }],
    scenarios: [],
  } as unknown as ChannelQuiz);
  assert.equal(loaded.questions[0].seconds, 45);
});

test('a refused save names the title, question or scenario at fault, so the form can go to it', () => {
  const filled = (scenarioKey: string | null = null): QuestionDraft => {
    const question = newQuestion(scenarioKey);
    question.question = 'TEST DATA. Is a lease an interest in land?';
    question.options = question.options.map((option, index) => ({ ...option, content: index === 0 ? 'Yes' : 'No' }));
    question.correctKey = question.options[0].key;
    return question;
  };
  assert.deepEqual(findFormProblem('', [filled()], []), { message: 'Give the quiz a title.', target: { kind: 'title' } });
  assert.deepEqual(findFormProblem('TEST DATA', [], []), { message: 'Add at least one question.', target: null });
  const second = filled();
  second.correctKey = null;
  assert.deepEqual(findFormProblem('TEST DATA', [filled(), second], []), {
    message: 'Question 2 needs one answer marked correct.',
    target: { kind: 'question', key: second.key },
  });
  const thin = filled();
  thin.options = [thin.options[0], { ...thin.options[1], content: '  ' }];
  assert.equal(findFormProblem('TEST DATA', [thin], [])?.message, 'Question 1 needs at least 2 answers.');
  const scenario = newScenario();
  assert.deepEqual(findFormProblem('TEST DATA', [filled(scenario.key)], [scenario]), {
    message: 'Scenario 1 needs its passage.',
    target: { kind: 'scenario', key: scenario.key },
  });
  assert.equal(findFormProblem('TEST DATA', [filled()], []), null);
  // `validate` is the same check, as a sentence.
  assert.equal(validate('TEST DATA', [filled(), second], []), 'Question 2 needs one answer marked correct.');
  // The form says it where the gap is, and scrolls there.
  const dialog = readFileSync(join(here, 'QuizFormDialog.tsx'), 'utf8');
  assert.match(dialog, /setChecking\(true\);\s*scrollToProblem\(found\.target\);\s*return;/);
  assert.match(dialog, /problem=\{problemAt\('question', question\.key\)\}/);
  assert.match(dialog, /problem=\{problemAt\('scenario', group\.scenario\.key\)\}/);
  assert.match(dialog, /id=\{`quiz-question-\$\{draft\.key\}`\}/);
});

test('the library form has the scenario box and leaves out the game switches; a channel form keeps them', () => {
  const dialog = readFileSync(join(here, 'QuizFormDialog.tsx'), 'utf8');
  assert.match(dialog, /const solo = !inRoom && channelUuid === undefined;/);
  // A channel game's switches fold under "Game settings" (Arthur's redesign, part A).
  assert.match(dialog, /\{!solo && \(\s*<Collapsible className="rounded-lg border">[\s\S]*?Game settings[\s\S]*?<SettingRow/);
  assert.match(dialog, /\{solo && \(\s*<Button[\s\S]*?Add a scenario/);
  assert.match(dialog, /: findFormProblem\(title, questions, scenarios\);/);
});

/* Discard changes? (Stay, 23 October 2026): a NEW quiz form with anything in
 * it asks before it closes; the untouched form closes at once. */
test('a new quiz form counts as filled in once anything is typed, marked or added', () => {
  const empty = { title: '', description: '', questions: [newQuestion()], scenarios: [] };
  assert.equal(hasFormContent(empty), false);
  assert.equal(hasFormContent({ ...empty, title: '  ' }), false);
  assert.equal(hasFormContent({ ...empty, title: 'TEST DATA quiz' }), true);
  assert.equal(hasFormContent({ ...empty, description: 'x' }), true);
  const typed = { ...newQuestion(), question: 'TEST DATA. What is consent?' };
  assert.equal(hasFormContent({ ...empty, questions: [typed] }), true);
  const option = newQuestion();
  option.options[0] = { ...option.options[0], content: 'Yes' };
  assert.equal(hasFormContent({ ...empty, questions: [option] }), true);
  const marked = { ...newQuestion(), correctKey: 'opt-x' };
  assert.equal(hasFormContent({ ...empty, questions: [marked] }), true);
  assert.equal(hasFormContent({ ...empty, questions: [newQuestion(), newQuestion()] }), true);
  assert.equal(hasFormContent({ ...empty, scenarios: [newScenario()] }), true);
});

test('Cancel, Escape, a tap outside and Back all go through the discard question', async () => {

  const dialog = readFileSync(new URL('./QuizFormDialog.tsx', import.meta.url), 'utf8');
  assert.match(dialog, /const dirty = !isEdit && hasFormContent\(\{ title, description, questions, scenarios \}\);/);
  assert.match(dialog, /onOpenChange=\{requestClose\}/);
  assert.match(dialog, /onClick=\{\(\) => requestClose\(false\)\}/);
  // Back takes one extra step while filled in, and asks; every close takes that step first.
  assert.match(dialog, /const backGuard = useBackGuard\(open && dirty, \(\) => setConfirmDiscard\(true\)\);/);
  assert.match(dialog, /const close = \(\) => backGuard\.release\(\(\) => onOpenChange\(false\)\);/);
  assert.doesNotMatch(dialog, /^\s+onOpenChange\(false\);$/m);
  assert.match(dialog, /if \(!next && !discardingRef\.current\) backGuard\.rearm\(\);/);
  const guard = readFileSync(new URL('../../../runtime/use-back-guard.ts', import.meta.url), 'utf8');
  // The extra step is the same address, never a push from inside the Back event.
  assert.match(guard, /quietPushStampedCopy\(\{ \[GUARD_KEY\]: 'on' \}\)/);
  assert.match(guard, /if \(releasingRef\.current \|\| readHistoryStamp\(GUARD_KEY\) !== null\) return;/);
  assert.match(dialog, /<AlertDialogTitle>Discard changes\?<\/AlertDialogTitle>/);
  assert.match(dialog, /<AlertDialogCancel>Keep editing<\/AlertDialogCancel>/);
  const library = readFileSync(new URL('../../quiz/solo/library/LibraryScreen.tsx', import.meta.url), 'utf8');
  assert.match(library, /const overlay = useUrlOverlay\(QUIZ_FORM_PARAM\);/);
});

test('a saved question and scenario go back with their uuids, so the server keeps their sources; a source is never sent', () => {
  const source = { kind: 'case' as const, id: 12, title: 'TEST DATA Ojukwu v Lagos State', quote: 'q', url: '/cases/x' };
  const quiz = {
    uuid: 'quiz-1',
    title: 'TEST DATA Easements',
    questions: [
      { uuid: 'qq-1', type: 'multiple_choice', question: 'TEST DATA Q1', time_limit_seconds: 30, position: 1, scenario_uuid: 'sc-1', explanation: null, source,
        options: [{ id: 1, content: 'A', position: 1, is_correct: true }, { id: 2, content: 'B', position: 2, is_correct: false }] },
    ],
    scenarios: [{ uuid: 'sc-1', title: 'TEST DATA Plot 14', passage: 'TEST DATA facts', position: 1, source }],
  } as never;
  const drafts = draftsFromQuiz(quiz);
  assert.equal(drafts.questions[0].uuid, 'qq-1');
  assert.deepEqual(drafts.questions[0].source, source);
  assert.equal(drafts.scenarios[0].uuid, 'sc-1');
  const payload = toPayload(drafts.questions, drafts.scenarios);
  assert.equal(payload.questions[0].uuid, 'qq-1');
  assert.equal(payload.scenarios[0].uuid, 'sc-1');
  assert.ok(!('source' in payload.questions[0]) && !('source' in payload.scenarios[0]));
  // A question added in the form has no uuid to send.
  assert.ok(!('uuid' in toPayload([newQuestion()], []).questions[0]));
});

test('a save puts the quiz the server returned, with its new uuids, where the form reads it next', () => {
  const mutations = readFileSync(join(here, 'mutations.ts'), 'utf8');
  const update = mutations.slice(mutations.indexOf('export function useUpdateQuiz'), mutations.indexOf('export function useUpdateQuiz') + 1200);
  assert.match(update, /onSuccess: \(response\) => \{[\s\S]*?queryClient\.setQueriesData\(\{ queryKey: channelQuizQueries\.quizDetailOf\(quizUuid\) \}, response\);[\s\S]*?invalidateQueries/);
});
