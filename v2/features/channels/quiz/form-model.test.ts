import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChannelQuiz } from '@/types/channel-quiz';
import {
  addToScenario,
  draftsFromQuiz,
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
  assert.deepEqual(payload.scenarios, [{ title: 'First', passage: 'First passage' }]);
  assert.equal(payload.questions[1].scenario_index, 0);
});

test('the library form has the scenario box and leaves out the game switches; a channel form keeps them', () => {
  const dialog = readFileSync(join(here, 'QuizFormDialog.tsx'), 'utf8');
  assert.match(dialog, /const solo = !inRoom && channelUuid === undefined;/);
  assert.match(dialog, /\{!solo && \(\s*<div className="space-y-3 rounded-lg border p-3">\s*<SettingRow/);
  assert.match(dialog, /\{solo && \(\s*<Button[\s\S]*?Add a scenario/);
  assert.match(dialog, /validate\(title, questions, scenarios\)/);
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
