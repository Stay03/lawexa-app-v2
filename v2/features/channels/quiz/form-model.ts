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

/** The first thing wrong with the draft, phrased for the author — or `null`. */
export function validate(title: string, questions: readonly QuestionDraft[], scenarios: readonly ScenarioDraft[]): string | null {
  if (!title.trim()) return 'Give the quiz a title.';
  if (questions.length === 0) return 'Add at least one question.';
  const used = new Set(questions.map((question) => question.scenarioKey).filter((key): key is string => key !== null));
  let scenarioNumber = 0;
  for (const scenario of scenarios) {
    if (!used.has(scenario.key)) continue;
    scenarioNumber += 1;
    if (!scenario.passage.trim()) return `Scenario ${scenarioNumber} needs its passage.`;
    if (scenario.title.trim().length > QUIZ_SCENARIO_TITLE_MAX) return `Scenario ${scenarioNumber}'s title is too long.`;
    if (scenario.passage.trim().length > QUIZ_SCENARIO_PASSAGE_MAX) return `Scenario ${scenarioNumber}'s passage is too long.`;
  }
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i];
    const label = `Question ${i + 1}`;
    if (!question.question.trim()) return `${label} needs its question text.`;
    const filled = question.options.filter((option) => option.content.trim());
    if (filled.length < QUIZ_MIN_OPTIONS) return `${label} needs at least ${QUIZ_MIN_OPTIONS} answers.`;
    if (question.correctKey === null) return `${label} needs one answer marked correct.`;
    if (!filled.some((option) => option.key === question.correctKey)) return `${label}'s correct answer is empty.`;
  }
  return null;
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
