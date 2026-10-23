import type { ToolMessage } from '@/types/chat';

/**
 * created-quiz — what Lawexa's `create_quiz` step made, as the chat's quiz
 * card draws it (quiz from a source, door 1; Stay, 23 October 2026: "a chat
 * message that uploads a document and Lawexa uses the create quiz tool").
 *
 * The shape is backend's (bb81d318): on success the tool result's data is
 * `{ quiz: { uuid, title, question_count, scenario_count, visibility, source:
 * { kind, title, range? }, url } }`; on failure `{ error: { code, message } }`,
 * whose message is a sentence to show as it is. Read defensively, like every
 * tool result: a shape it does not know is `null`, and the step's own row
 * still says what happened.
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
  const data = payload(message.toolResult?.data);
  const error = record(data?.error);
  if (error) {
    const text = typeof error.message === 'string' && error.message.trim() ? error.message.trim() : null;
    return { kind: 'failed', message: text ?? 'Lawexa could not make the quiz this time.' };
  }
  if (message.toolResult?.success === false) {
    const text = typeof message.toolResult.error === 'string' && message.toolResult.error.trim() ? message.toolResult.error.trim() : null;
    return { kind: 'failed', message: text ?? 'Lawexa could not make the quiz this time.' };
  }
  const quiz = record(data?.quiz);
  if (!quiz || typeof quiz.uuid !== 'string' || !quiz.uuid || typeof quiz.title !== 'string') return null;
  const source = record(quiz.source);
  const sourceTitle = typeof source?.title === 'string' && source.title.trim() ? source.title.trim() : null;
  const range = typeof source?.range === 'string' && source.range.trim() ? source.range.trim() : null;
  return {
    kind: 'ready',
    uuid: quiz.uuid,
    title: quiz.title.trim() || 'Your quiz',
    questionCount: typeof quiz.question_count === 'number' ? quiz.question_count : 0,
    scenarioCount: typeof quiz.scenario_count === 'number' ? quiz.scenario_count : 0,
    source: sourceTitle ? (range ? `${sourceTitle}, ${range}` : sourceTitle) : null,
  };
}

/** "10 questions · 1 scenario · from TEST DATA tenancy notes.pdf". */
export function createdQuizLine(quiz: Extract<CreatedQuiz, { kind: 'ready' }>): string {
  const parts = [`${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'}`];
  if (quiz.scenarioCount > 0) parts.push(`${quiz.scenarioCount} ${quiz.scenarioCount === 1 ? 'scenario' : 'scenarios'}`);
  if (quiz.source) parts.push(`from ${quiz.source}`);
  return parts.join(' · ');
}
