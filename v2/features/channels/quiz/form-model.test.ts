import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChannelQuiz } from '@/types/channel-quiz';
import {
  addToScenario,
  canMoveOutOfScenario,
  canMoveQuestion,
  canMoveScenario,
  draftsFromQuiz,
  duplicateQuestion,
  findFormProblem,
  groupQuestions,
  hasFormContent,
  insertQuestionAfter,
  moveIntoScenario,
  moveOutOfScenario,
  moveQuestion,
  moveScenario,
  newQuestion,
  newScenario,
  questionsFingerprint,
  toPayload,
  validate,
  type QuestionDraft,
} from './form-model';

/* Arthur's redesign, part B (25 October 2026): reorder, duplicate, insert, and
 * move questions into and out of scenarios, always keeping a scenario's
 * questions together (the server's 422). TEST DATA throughout. */

/** A labelled question, so the list reads as its labels. */
const named = (label: string, scenarioKey: string | null = null): QuestionDraft => ({ ...newQuestion(scenarioKey), question: label });
const labels = (list: readonly QuestionDraft[]) => list.map((question) => question.question);
/** Every scenario's questions sit next to each other. */
const together = (list: readonly QuestionDraft[]) => {
  const seen = new Set<string>();
  let last: string | null = null;
  for (const question of list) {
    if (question.scenarioKey && question.scenarioKey !== last) {
      if (seen.has(question.scenarioKey)) return false;
      seen.add(question.scenarioKey);
    }
    last = question.scenarioKey;
  }
  return true;
};

test('a question on its own moves past a whole scenario at once', () => {
  const s = newScenario();
  const list = [named('A'), named('S1', s.key), named('S2', s.key), named('B')];
  const aDown = moveQuestion(list, list[0].key, 'down');
  assert.deepEqual(labels(aDown), ['S1', 'S2', 'A', 'B']);
  assert.ok(together(aDown));
  assert.deepEqual(labels(moveQuestion(list, list[3].key, 'up')), ['A', 'B', 'S1', 'S2']);
  // At the ends nothing moves, and the menu offers it disabled.
  assert.equal(moveQuestion(list, list[0].key, 'up'), list);
  assert.equal(canMoveQuestion(list, list[0].key, 'up'), false);
  assert.equal(canMoveQuestion(list, list[3].key, 'down'), false);
});

test('a scenario question moves only inside its scenario; a scenario moves as one block', () => {
  const s = newScenario();
  const list = [named('A'), named('S1', s.key), named('S2', s.key), named('B')];
  assert.deepEqual(labels(moveQuestion(list, list[1].key, 'down')), ['A', 'S2', 'S1', 'B']);
  // Its first question cannot leave the box by moving up.
  assert.equal(canMoveQuestion(list, list[1].key, 'up'), false);
  assert.equal(canMoveQuestion(list, list[2].key, 'down'), false);
  assert.deepEqual(labels(moveScenario(list, s.key, 'up')), ['S1', 'S2', 'A', 'B']);
  assert.deepEqual(labels(moveScenario(list, s.key, 'down')), ['A', 'B', 'S1', 'S2']);
  assert.equal(canMoveScenario([named('S1', s.key)], s.key, 'up'), false);
});

test('duplicate copies a question right after it, as a new question with its answer marked', () => {
  const original = named('A');
  original.options = original.options.map((option, index) => ({ ...option, content: index === 0 ? 'Yes' : 'No' }));
  original.correctKey = original.options[1].key;
  original.uuid = 'stored-1';
  const list = duplicateQuestion([original, named('B')], original.key);
  assert.deepEqual(labels(list), ['A', 'A', 'B']);
  const copy = list[1];
  assert.notEqual(copy.key, original.key);
  assert.equal(copy.uuid, undefined);
  assert.deepEqual(copy.options.map((option) => option.content), ['Yes', 'No']);
  assert.equal(copy.correctKey, copy.options[1].key);
  assert.notEqual(copy.correctKey, original.correctKey);
});

test('add a question below puts an empty one right after, in the same scenario', () => {
  const s = newScenario();
  const list = [named('S1', s.key), named('S2', s.key), named('B')];
  const added = insertQuestionAfter(list, list[0].key);
  assert.deepEqual(labels(added), ['S1', '', 'S2', 'B']);
  assert.equal(added[1].scenarioKey, s.key);
  assert.ok(together(added));
});

test('a question moves into a scenario as its last question, and out of it right after it', () => {
  const s = newScenario();
  const list = [named('A'), named('S1', s.key), named('S2', s.key), named('B')];
  const into = moveIntoScenario(list, list[0].key, s.key);
  assert.deepEqual(labels(into), ['S1', 'S2', 'A', 'B']);
  assert.equal(into[2].scenarioKey, s.key);
  assert.ok(together(into));
  const out = moveOutOfScenario(list, list[1].key);
  assert.deepEqual(labels(out), ['A', 'S2', 'S1', 'B']);
  assert.equal(out[2].scenarioKey, null);
  // A scenario's only question cannot leave it: the scenario would be dropped.
  const lone = [named('S1', s.key)];
  assert.equal(canMoveOutOfScenario(lone, lone[0].key), false);
  assert.deepEqual(labels(moveOutOfScenario(lone, lone[0].key)), ['S1']);
  assert.equal(lone[0].scenarioKey, s.key);
});

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

test('a quiz loaded twice reads the same, and any change to its questions reads as a change', () => {
  // 28 October 2026: every edit resent every question, and a resend can restart the board.
  const stored = {
    scenarios: [{ uuid: 's-a', title: 'TEST DATA', passage: 'TEST DATA passage', position: 1 }],
    questions: [
      { uuid: 'q-1', type: 'multiple_choice', question: 'TEST DATA Q1', time_limit_seconds: 20, position: 1, scenario_uuid: null, options: [{ content: 'A', is_correct: true }, { content: 'B', is_correct: false }] },
      { uuid: 'q-2', type: 'true_false', question: 'TEST DATA Q2', time_limit_seconds: 45, position: 2, scenario_uuid: 's-a', options: [{ content: 'True', is_correct: false }, { content: 'False', is_correct: true }] },
    ],
  } as unknown as ChannelQuiz;
  const first = draftsFromQuiz(stored);
  const again = draftsFromQuiz(stored);
  const loaded = questionsFingerprint(first.questions, first.scenarios);
  assert.equal(questionsFingerprint(again.questions, again.scenarios), loaded);
  // A new right answer, a new time, new words or a new passage are each a change.
  const right = first.questions.map((q, i) => (i === 0 ? { ...q, correctKey: q.options[1].key } : q));
  assert.notEqual(questionsFingerprint(right, first.scenarios), loaded);
  const time = first.questions.map((q, i) => (i === 1 ? { ...q, seconds: 30 } : q));
  assert.notEqual(questionsFingerprint(time, first.scenarios), loaded);
  const words = first.questions.map((q, i) => (i === 0 ? { ...q, question: 'TEST DATA Q1, reworded' } : q));
  assert.notEqual(questionsFingerprint(words, first.scenarios), loaded);
  const passage = first.scenarios.map((s) => ({ ...s, passage: 'TEST DATA a new passage' }));
  assert.notEqual(questionsFingerprint(first.questions, passage), loaded);
  // A question added or taken away is a change.
  assert.notEqual(questionsFingerprint([...first.questions, newQuestion()], first.scenarios), loaded);
  assert.notEqual(questionsFingerprint(first.questions.slice(1), first.scenarios), loaded);
});

test('an edit sends its questions only when they changed, so a tag edit keeps the board', () => {
  const form = readFileSync(join(here, 'QuizFormDialog.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(form, /setLoadedQuestions\(questionsFingerprint\(drafts\.questions, drafts\.scenarios\)\);/);
  assert.match(form, /const questionsEdited = loadedQuestions === null \|\| questionsFingerprint\(questions, scenarios\) !== loadedQuestions;/);
  assert.match(form, /\.\.\.\(metadataOnly \|\| !mayEditQuestions \|\| !questionsEdited \? \{\} : toPayload\(questions, scenarios\)\),/);
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

test('the form offers the moves in each question\'s menu, a jump row for longer quizzes, and Add below', () => {
  const dialog = readFileSync(join(here, 'QuizFormDialog.tsx'), 'utf8');
  assert.match(dialog, /<QuestionMenu number=\{number\} menu=\{menu\} \/>/);
  assert.match(dialog, /onMove: \(direction\) => setQuestions\(\(prev\) => \[\.\.\.moveQuestion\(prev, question\.key, direction\)\]\),/);
  assert.match(dialog, /onDuplicate: \(\) => setQuestions\(\(prev\) => duplicateQuestion\(prev, question\.key\)\),/);
  assert.match(dialog, /intoScenarios: question\.scenarioKey === null && solo \? scenarioNumbers : \[\],/);
  assert.match(dialog, /\{questions\.length >= QUESTION_JUMP_FROM \? \(\s*<QuestionJump/);
  assert.match(dialog, /const QUESTION_JUMP_FROM = 4;/);
  assert.match(dialog, /Add a question below/);
  assert.match(dialog, /A passage several questions share\. The reader sees it above each question in this box\./);
});
