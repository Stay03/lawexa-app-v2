import type {
  ChannelQuiz,
  QuizQuestionInput,
  QuizQuestionType,
  QuizScenarioInput,
  QuizSource,
} from '@/types/channel-quiz';
import { QUIZ_DEFAULT_SECONDS, QUIZ_MIN_OPTIONS } from './model';

/**
 * form-model — the quiz form's drafts and their rules, without React, so they
 * are tested here (`QuizFormDialog` draws them).
 *
 * ── SCENARIOS (quiz piece 4, Stay, 23 October 2026, picture 6) ─────────────
 * A scenario is a passage several questions share; the reader sees it above
 * each of them. A question names its scenario by the draft's key
 * (`scenarioKey`), and the questions of one scenario stay next to each other
 * in the list, because the server refuses a split set (`422 "The questions
 * about scenario N must come one after another."`). The form only ever adds a
 * scenario's questions inside its card, so the list keeps that shape by
 * construction; `toPayload` sends the scenarios in the order they first
 * appear and each question's `scenario_index` into that order.
 */

export const QUIZ_SCENARIO_TITLE_MAX = 200;
export const QUIZ_SCENARIO_PASSAGE_MAX = 10_000;

export interface OptionDraft {
  key: string;
  content: string;
}

export interface QuestionDraft {
  key: string;
  type: QuizQuestionType;
  question: string;
  seconds: number;
  options: OptionDraft[];
  /** The `key` of the option marked correct — exactly one, or none yet. */
  correctKey: string | null;
  /** "Why this is the answer", optional; `''` for none. */
  explanation: string;
  /** The scenario this question is about, by its draft key; `null` for none. */
  scenarioKey: string | null;
  /** Where Lawexa took it from (the quiz builder); shown, not edited. Absent on a new question. */
  source?: QuizSource | null;
  /** The stored question this draft was loaded from, sent back so the server keeps its source. Absent on a new one. */
  uuid?: string;
}

export interface ScenarioDraft {
  key: string;
  /** Optional; `''` for none. */
  title: string;
  passage: string;
  /** Where Lawexa took it from (the quiz builder); shown, not edited. Absent on a new scenario. */
  source?: QuizSource | null;
  /** The stored scenario this draft was loaded from, sent back so the server keeps its source. Absent on a new one. */
  uuid?: string;
}

let draftCounter = 0;
export function nextKey(prefix: string): string {
  draftCounter += 1;
  return `${prefix}-${draftCounter}`;
}

export function newOption(content = ''): OptionDraft {
  return { key: nextKey('opt'), content };
}

export function newQuestion(scenarioKey: string | null = null): QuestionDraft {
  return {
    key: nextKey('q'),
    type: 'multiple_choice',
    question: '',
    seconds: QUIZ_DEFAULT_SECONDS,
    options: [newOption(), newOption()],
    correctKey: null,
    explanation: '',
    scenarioKey,
  };
}

/**
 * Whether a NEW quiz form holds anything the author would lose by closing it
 * (Stay, 23 October 2026: Cancel on a filled-in form asks "Discard changes?").
 * Any typed text, a marked answer, a second question or a scenario counts; the
 * untouched form it opens as does not, so an empty form closes at once.
 */
export function hasFormContent(draft: {
  title: string;
  description: string;
  questions: readonly QuestionDraft[];
  scenarios: readonly ScenarioDraft[];
}): boolean {
  const typed = (value: string) => value.trim().length > 0;
  if (typed(draft.title) || typed(draft.description)) return true;
  if (draft.scenarios.length > 0 || draft.questions.length > 1) return true;
  return draft.questions.some(
    (question) =>
      typed(question.question) ||
      typed(question.explanation) ||
      question.correctKey !== null ||
      question.options.some((option) => typed(option.content)),
  );
}

export function newScenario(): ScenarioDraft {
  return { key: nextKey('s'), title: '', passage: '' };
}

/** True/false questions are exactly two fixed options — the server validates
 *  the count, and offering free text for them would only invite a 422. */
export function trueFalseOptions(): OptionDraft[] {
  return [newOption('True'), newOption('False')];
}

/** A saved quiz as drafts: its questions in order, each still pointing at its
 *  scenario, and the scenarios it has. */
export function draftsFromQuiz(quiz: ChannelQuiz): { questions: QuestionDraft[]; scenarios: ScenarioDraft[] } {
  const scenarios = [...(quiz.scenarios ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((scenario) => ({ uuid: scenario.uuid, draft: { key: nextKey('s'), uuid: scenario.uuid, title: scenario.title ?? '', passage: scenario.passage, source: scenario.source ?? null } }));
  const keyOf = new Map(scenarios.map(({ uuid, draft }) => [uuid, draft.key]));
  const questions = [...(quiz.questions ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((question) => {
      const options = question.options.map((option) => ({ key: nextKey('opt'), content: option.content }));
      const correctIndex = question.options.findIndex((option) => option.is_correct);
      return {
        key: nextKey('q'),
        type: question.type,
        question: question.question,
        seconds: question.time_limit_seconds,
        options,
        correctKey: correctIndex >= 0 ? options[correctIndex].key : null,
        explanation: question.explanation ?? '',
        scenarioKey: question.scenario_uuid ? (keyOf.get(question.scenario_uuid) ?? null) : null,
        source: question.source ?? null,
        uuid: question.uuid,
      };
    });
  return { questions, scenarios: scenarios.map(({ draft }) => draft) };
}

/** One run of the list as the form draws it: a question on its own, or a
 *  scenario's card with its questions. `start` is the first question's place. */
export type QuestionGroup =
  | { kind: 'question'; question: QuestionDraft; start: number }
  | { kind: 'scenario'; scenario: ScenarioDraft; questions: QuestionDraft[]; start: number };

export function groupQuestions(questions: readonly QuestionDraft[], scenarios: readonly ScenarioDraft[]): QuestionGroup[] {
  const byKey = new Map(scenarios.map((scenario) => [scenario.key, scenario]));
  const groups: QuestionGroup[] = [];
  questions.forEach((question, index) => {
    const scenario = question.scenarioKey ? byKey.get(question.scenarioKey) : undefined;
    const last = groups[groups.length - 1];
    if (!scenario) {
      groups.push({ kind: 'question', question, start: index });
    } else if (last?.kind === 'scenario' && last.scenario.key === scenario.key) {
      last.questions.push(question);
    } else {
      groups.push({ kind: 'scenario', scenario, questions: [question], start: index });
    }
  });
  return groups;
}

/** The list after a new question is added to a scenario: right after that
 *  scenario's last question, so its set stays together. */
export function addToScenario(questions: readonly QuestionDraft[], scenarioKey: string): QuestionDraft[] {
  const lastIndex = questions.reduce((found, question, index) => (question.scenarioKey === scenarioKey ? index : found), -1);
  const next = [...questions];
  next.splice(lastIndex + 1, 0, newQuestion(scenarioKey));
  return next;
}

/* ── Managing the list (Arthur's redesign, part B, 25 October 2026) ────────────
 * Reorder, duplicate, insert, and move a question into or out of a scenario.
 * Every move keeps a scenario's questions next to each other, which the server
 * requires (`422`): a question on its own steps past a whole scenario at once,
 * a scenario's question moves only inside its scenario, and a scenario moves
 * as one block. A move that cannot happen returns the same list, so the menu
 * can offer it disabled (`canMove…`). */

export type MoveDirection = 'up' | 'down';

/** The list in runs: a question on its own, or a scenario's questions together. */
function runsOf(questions: readonly QuestionDraft[]): QuestionDraft[][] {
  const runs: QuestionDraft[][] = [];
  for (const question of questions) {
    const last = runs[runs.length - 1];
    if (question.scenarioKey && last && last[0].scenarioKey === question.scenarioKey) last.push(question);
    else runs.push([question]);
  }
  return runs;
}

function swapRuns(runs: QuestionDraft[][], index: number, direction: MoveDirection): QuestionDraft[] | null {
  const other = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || other < 0 || other >= runs.length) return null;
  const next = [...runs];
  [next[index], next[other]] = [next[other], next[index]];
  return next.flat();
}

/** One question up or down, keeping every scenario's questions together. */
export function moveQuestion(questions: readonly QuestionDraft[], key: string, direction: MoveDirection): readonly QuestionDraft[] {
  const index = questions.findIndex((question) => question.key === key);
  if (index < 0) return questions;
  const question = questions[index];
  if (question.scenarioKey) {
    const other = direction === 'up' ? index - 1 : index + 1;
    if (questions[other]?.scenarioKey !== question.scenarioKey) return questions;
    const next = [...questions];
    [next[index], next[other]] = [next[other], next[index]];
    return next;
  }
  const runs = runsOf(questions);
  return swapRuns(runs, runs.findIndex((run) => run[0].key === key), direction) ?? questions;
}

export function canMoveQuestion(questions: readonly QuestionDraft[], key: string, direction: MoveDirection): boolean {
  return moveQuestion(questions, key, direction) !== questions;
}

/** A whole scenario, with its questions, up or down past the next run. */
export function moveScenario(questions: readonly QuestionDraft[], scenarioKey: string, direction: MoveDirection): readonly QuestionDraft[] {
  const runs = runsOf(questions);
  return swapRuns(runs, runs.findIndex((run) => run[0].scenarioKey === scenarioKey), direction) ?? questions;
}

export function canMoveScenario(questions: readonly QuestionDraft[], scenarioKey: string, direction: MoveDirection): boolean {
  return moveScenario(questions, scenarioKey, direction) !== questions;
}

/** A copy of the question right after it, as a new question: new keys, and no
 *  stored id or source, so the server files it as written here. */
export function duplicateQuestion(questions: readonly QuestionDraft[], key: string): QuestionDraft[] {
  const index = questions.findIndex((question) => question.key === key);
  if (index < 0) return [...questions];
  const original = questions[index];
  const options = original.options.map((option) => newOption(option.content));
  const correctAt = original.options.findIndex((option) => option.key === original.correctKey);
  const copy: QuestionDraft = {
    key: nextKey('q'),
    type: original.type,
    question: original.question,
    seconds: original.seconds,
    options,
    correctKey: correctAt >= 0 ? options[correctAt].key : null,
    explanation: original.explanation,
    scenarioKey: original.scenarioKey,
  };
  const next = [...questions];
  next.splice(index + 1, 0, copy);
  return next;
}

/** A new, empty question right after this one, in the same scenario if it is in one. */
export function insertQuestionAfter(questions: readonly QuestionDraft[], key: string): QuestionDraft[] {
  const index = questions.findIndex((question) => question.key === key);
  const next = [...questions];
  next.splice(index < 0 ? next.length : index + 1, 0, newQuestion(index < 0 ? null : questions[index].scenarioKey));
  return next;
}

/** A question on its own into a scenario, as that scenario's last question. */
export function moveIntoScenario(questions: readonly QuestionDraft[], key: string, scenarioKey: string): QuestionDraft[] {
  const question = questions.find((entry) => entry.key === key);
  if (!question || question.scenarioKey !== null) return [...questions];
  const rest = questions.filter((entry) => entry.key !== key);
  const lastIndex = rest.reduce((found, entry, index) => (entry.scenarioKey === scenarioKey ? index : found), -1);
  if (lastIndex < 0) return [...questions];
  rest.splice(lastIndex + 1, 0, { ...question, scenarioKey });
  return rest;
}

/** A scenario's question out of it, placed right after the scenario. Not the
 *  scenario's only question: the scenario would be left with none and dropped. */
export function moveOutOfScenario(questions: readonly QuestionDraft[], key: string): QuestionDraft[] {
  const question = questions.find((entry) => entry.key === key);
  if (!question?.scenarioKey || !canMoveOutOfScenario(questions, key)) return [...questions];
  const rest = questions.filter((entry) => entry.key !== key);
  const lastIndex = rest.reduce((found, entry, index) => (entry.scenarioKey === question.scenarioKey ? index : found), -1);
  rest.splice(lastIndex + 1, 0, { ...question, scenarioKey: null });
  return rest;
}

export function canMoveOutOfScenario(questions: readonly QuestionDraft[], key: string): boolean {
  const question = questions.find((entry) => entry.key === key);
  if (!question?.scenarioKey) return false;
  return questions.filter((entry) => entry.scenarioKey === question.scenarioKey).length > 1;
}

/** Where a refused save points: the title, a question or a scenario, by draft key. */
export type FormProblemTarget =
  | { kind: 'title' }
  | { kind: 'question'; key: string }
  | { kind: 'scenario'; key: string };

export interface FormProblem {
  message: string;
  /** `null` when the problem is the quiz as a whole (no questions at all). */
  target: FormProblemTarget | null;
}

/**
 * The first thing that stops a save, and where it is (Arthur, 25 October
 * 2026: "validate that each question has sufficient options and a correct
 * answer before publication"). The form scrolls to the target and says the
 * sentence there, so a gap on question seventeen is found at once.
 */
export function findFormProblem(
  title: string,
  questions: readonly QuestionDraft[],
  scenarios: readonly ScenarioDraft[],
): FormProblem | null {
  if (!title.trim()) return { message: 'Give the quiz a title.', target: { kind: 'title' } };
  if (questions.length === 0) return { message: 'Add at least one question.', target: null };
  const used = new Set(questions.map((question) => question.scenarioKey).filter((key): key is string => key !== null));
  let scenarioNumber = 0;
  for (const scenario of scenarios) {
    if (!used.has(scenario.key)) continue;
    scenarioNumber += 1;
    const target = { kind: 'scenario', key: scenario.key } as const;
    if (!scenario.passage.trim()) return { message: `Scenario ${scenarioNumber} needs its passage.`, target };
    if (scenario.title.trim().length > QUIZ_SCENARIO_TITLE_MAX) return { message: `Scenario ${scenarioNumber}'s title is too long.`, target };
    if (scenario.passage.trim().length > QUIZ_SCENARIO_PASSAGE_MAX) return { message: `Scenario ${scenarioNumber}'s passage is too long.`, target };
  }
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i];
    const label = `Question ${i + 1}`;
    const target = { kind: 'question', key: question.key } as const;
    if (!question.question.trim()) return { message: `${label} needs its question text.`, target };
    const filled = question.options.filter((option) => option.content.trim());
    if (filled.length < QUIZ_MIN_OPTIONS) return { message: `${label} needs at least ${QUIZ_MIN_OPTIONS} answers.`, target };
    if (question.correctKey === null) return { message: `${label} needs one answer marked correct.`, target };
    if (!filled.some((option) => option.key === question.correctKey)) return { message: `${label}'s correct answer is empty.`, target };
  }
  return null;
}

/** The sentence alone, for a caller that only needs to know whether it saves. */
export function validate(title: string, questions: readonly QuestionDraft[], scenarios: readonly ScenarioDraft[]): string | null {
  return findFormProblem(title, questions, scenarios)?.message ?? null;
}

/**
 * The questions and scenarios as a save would send them, as one string, so an
 * edit can tell whether the author changed any (28 October 2026: every edit
 * resent every question, and a resend can restart the quiz's leaderboard).
 * Draft keys are not in it, so a quiz loaded twice reads the same.
 */
export function questionsFingerprint(questions: readonly QuestionDraft[], scenarios: readonly ScenarioDraft[]): string {
  return JSON.stringify(toPayload(questions, scenarios));
}

/** The questions and scenarios as the server takes them. */
export function toPayload(
  questions: readonly QuestionDraft[],
  scenarios: readonly ScenarioDraft[],
): { questions: QuizQuestionInput[]; scenarios: QuizScenarioInput[] } {
  const byKey = new Map(scenarios.map((scenario) => [scenario.key, scenario]));
  const order: string[] = [];
  for (const question of questions) {
    if (question.scenarioKey && byKey.has(question.scenarioKey) && !order.includes(question.scenarioKey)) order.push(question.scenarioKey);
  }
  return {
    questions: questions.map((question) => {
      const index = question.scenarioKey ? order.indexOf(question.scenarioKey) : -1;
      return {
        type: question.type,
        question: question.question.trim(),
        time_limit_seconds: question.seconds,
        options: question.options
          .filter((option) => option.content.trim())
          .map((option) => ({ content: option.content.trim(), is_correct: option.key === question.correctKey })),
        // Always sent, so clearing the box clears the stored explanation.
        explanation: question.explanation.trim() || null,
        ...(index >= 0 ? { scenario_index: index } : {}),
        // A saved question goes back with its uuid: the server rebuilds the
        // questions from this body and copies the stored row's source onto
        // the new one (backend, 24 October 2026). A source is never sent.
        ...(question.uuid ? { uuid: question.uuid } : {}),
      };
    }),
    scenarios: order.flatMap((key) => {
      const scenario = byKey.get(key);
      if (!scenario) return [];
      const title = scenario.title.trim();
      return [{ ...(scenario.uuid ? { uuid: scenario.uuid } : {}), ...(title ? { title } : {}), passage: scenario.passage.trim() }];
    }),
  };
}

/**
 * What a 409 on saving a quiz means (Backend, 26 October 2026: every 409 on
 * PUT /channel-quizzes/{quiz} carries `errors.reason`):
 *   questions_played  a game recorded answers, so the questions are frozen for
 *                     good: the form offers to save the title and settings only
 *   quiz_live         a game is in its lobby, countdown or play
 *   question_in_use   the save drops a question someone is answering right now
 * The last two pass: the form says the server's sentence, keeps every edit, and
 * the author saves again once the game or the attempt ends. A 409 with no
 * reason is read as passing too, never as a freeze.
 */
export function quizSaveConflict(reason: unknown): 'frozen' | 'temporary' {
  return reason === 'questions_played' ? 'frozen' : 'temporary';
}
