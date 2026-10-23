import type { ToolMessage } from '@/types/chat';

/**
 * created-quiz — what Lawexa's `create_quiz` step made, as the chat's quiz
 * card draws it (quiz from a source, door 1; Stay, 23 October 2026: "a chat
 * message that uploads a document and Lawexa uses the create quiz tool").
 *
 * READ BY CONTENT, NOT BY FLAGS (backend, reading the AI service, 23 October
 * 2026). A made quiz's result is the whole body, so its data carries `quiz:
 * { uuid, title, question_count, scenario_count, visibility, source: { kind,
 * title, range? }, url }`. A refusal keeps only the server's sentence: the
 * AI service stores a 4xx or 5xx body's `message` alone, so no error code
 * reaches the chat, and for a reader below researcher the step even reads
 * `success: true`. So `data.quiz` means ready, and anything else with a
 * sentence (a lazy result's `error`, or the fetched result's bare text) is
 * that sentence, shown as it is. A result not loaded yet is `null`, and the
 * card asks for it.
 */

export const CREATE_QUIZ_TOOL = 'create_quiz';

export type CreatedQuiz =
  | { kind: 'making' }
  | {
      kind: 'ready';
      uuid: string;
      title: string;
      questionCount: number;
      scenarioCount: number;
      /** "TEST DATA tenancy notes.pdf", with a statute's part range when there is one. */
      source: string | null;
    }
  | { kind: 'failed'; message: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** The data, unwrapped from the `{ data }` envelope a stored result can carry. */
function payload(data: unknown): Record<string, unknown> | null {
  const top = record(data);
  if (!top) return null;
  return record(top.data) ?? top;
}

export function isCreateQuizStep(message: ToolMessage): boolean {
  return message.toolName === CREATE_QUIZ_TOOL;
}

/**
 * The quiz card's state for one `create_quiz` step: `making` while it runs,
 * `ready` with the quiz, `failed` with the server's sentence, or `null` when
 * the result is not there yet or is a shape this does not know.
 */
export function createdQuiz(message: ToolMessage): CreatedQuiz | null {
  if (!isCreateQuizStep(message)) return null;
  if (message.toolStatus !== 'complete') return { kind: 'making' };
  const result = message.toolResult;
  const data = payload(result?.data);
  const quiz = record(data?.quiz);
  if (quiz && typeof quiz.uuid === 'string' && quiz.uuid && typeof quiz.title === 'string') {
    const source = record(quiz.source);
    const sourceTitle = text(source?.title);
    const range = text(source?.range);
    return {
      kind: 'ready',
      uuid: quiz.uuid,
      title: quiz.title.trim() || 'Your quiz',
      questionCount: typeof quiz.question_count === 'number' ? quiz.question_count : 0,
      scenarioCount: typeof quiz.scenario_count === 'number' ? quiz.scenario_count : 0,
      source: sourceTitle ? (range ? `${sourceTitle}, ${range}` : sourceTitle) : null,
    };
  }
  const sentence =
    text(result?.error) ??
    text(result?.data) ??
    text(data?.message) ??
    text(record(data?.error)?.message);
  if (sentence) return { kind: 'failed', message: sentence };
  // Not loaded yet (a lazy result): the card asks for it.
  if (result?.data == null) return null;
  return { kind: 'failed', message: 'Lawexa could not make the quiz this time.' };
}

/** A non-empty trimmed string, or `null`. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** "10 questions · 1 scenario · from TEST DATA tenancy notes.pdf". */
export function createdQuizLine(quiz: Extract<CreatedQuiz, { kind: 'ready' }>): string {
  const parts = [`${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'}`];
  if (quiz.scenarioCount > 0) parts.push(`${quiz.scenarioCount} ${quiz.scenarioCount === 1 ? 'scenario' : 'scenarios'}`);
  if (quiz.source) parts.push(`from ${quiz.source}`);
  return parts.join(' · ');
}
