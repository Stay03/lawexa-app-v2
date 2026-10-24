import type { ToolMessage } from '@/types/chat';

/**
 * created-quiz — what Lawexa's `create_quiz` step made, as the chat's quiz
 * card draws it (quiz from a source, door 1; Stay, 23 October 2026: "a chat
 * message that uploads a document and Lawexa uses the create quiz tool").
 *
 * READ BY CONTENT, NOT BY FLAGS (backend, reading the AI service, 23 October
 * 2026). A made quiz's result is the whole body, so its data carries `quiz:
 * { uuid, title, question_count, scenario_count, visibility, source: { kind,
 * title, range? }, url }`; a quiz still being made carries `quiz_job` (below).
 * A refusal is stored whole, as HTTP 200 with `data.error { code, message }`
 * in the server's words, and is shown as it is. Anything else on a quiz step
 * is a transport failure (backend, 24 October 2026): a lazy row's `error`, the
 * masked "That lookup found nothing…" a reader below researcher gets (it reads
 * `success: true` on purpose), a bare "HTTP 500". It never shows its own words.
 * A result not loaded yet is `null`, and the card asks for it.
 *
 * A QUIZ STILL BEING MADE (backend, 24 October 2026: the server ends a request
 * after 30 s, and a large statute took longer, so Stay saw "HTTP 500"). The
 * step now returns at once with `data.quiz_job { uuid, status, question_count,
 * source }`, and the card polls the job (`quizJobState`) until it is done or
 * failed. A bare transport error ("HTTP 500" and the like) is never shown as
 * it is: the card and the step say {@link QUIZ_TRANSPORT_FAILURE}.
 */

export const CREATE_QUIZ_TOOL = 'create_quiz';

/** What the reader is told for a transport error in place of its code. */
export const QUIZ_TRANSPORT_FAILURE = "Lawexa couldn't make this quiz. Try again.";

/** A quiz the server is still making: the job to poll, and what the card says about it. */
export interface QuizJobRef {
  uuid: string;
  questionCount: number;
  /** "Labour Act, 1974, Part II", from the step (the poll returns only the raw request). */
  source: string | null;
}

export type CreatedQuiz =
  | { kind: 'making' }
  | { kind: 'job'; job: QuizJobRef }
  | {
      kind: 'ready';
      uuid: string;
      title: string;
      questionCount: number;
      scenarioCount: number;
      /** "TEST DATA tenancy notes.pdf", with a statute's part range when there is one. */
      source: string | null;
      /** How many questions were asked, when the quiz holds fewer (a job's source ran out); else absent. */
      asked?: number;
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
 * The `create_quiz` steps that get a card under one answer, read from their
 * LOADED results (`useToolResults`): a reopened chat downloads them lazily, so
 * before the fetch neither a refusal nor a made quiz can be told (Lucy's
 * reload of chat 8f58bf9b, 24 October 2026).
 *
 * A refusal shows only when every later quiz step in the answer is known
 * refused too, or there is none: a later step that made a quiz, is still
 * making one, or has not loaded yet hides it (Lucy's live check: a first call
 * with a made-up note id was refused, the second made the quiz, and the grey
 * refusal sat above the good card). A step not loaded yet with a later quiz
 * step after it waits, so no card shows and then goes. The last step always
 * gets its card, as a skeleton while it loads.
 */
export function quizCardSteps(steps: ToolMessage[]): ToolMessage[] {
  const quizSteps = steps.filter(isCreateQuizStep);
  const states = quizSteps.map(createdQuiz);
  return quizSteps.filter((_, index) => {
    const later = states.slice(index + 1);
    if (later.length === 0) return true;
    const state = states[index];
    if (state === null) return false;
    if (state.kind === 'failed') return later.every((next) => next?.kind === 'failed');
    return true;
  });
}

/**
 * The quiz card's state for one `create_quiz` step: `making` while it runs,
 * `ready` with the quiz, `failed` with the server's sentence, or `null` when
 * the result is not there yet or is a shape this does not know.
 */
export function createdQuiz(message: ToolMessage): CreatedQuiz | null {
  if (!isCreateQuizStep(message)) return null;
  if (message.toolStatus !== 'complete') return { kind: 'making' };
  return finishedQuiz(message.toolResult, Boolean(message.resultRef));
}

/** A finished step's quiz, from its result and whether a lazy result is still to fetch. */
function finishedQuiz(result: ToolMessage['toolResult'], hasRef: boolean): CreatedQuiz | null {
  const data = payload(result?.data);
  const quiz = readyQuiz(record(data?.quiz), null);
  if (quiz) return quiz;
  const job = record(data?.quiz_job);
  if (job && typeof job.uuid === 'string' && job.uuid) {
    return { kind: 'job', job: { uuid: job.uuid, questionCount: count(job.question_count), source: sourceLine(record(job.source)) } };
  }
  // A refusal (no access, too short, unreadable, one at a time) is always
  // stored whole: `data.error { code, message }`, in the server's words
  // (backend, 24 October 2026). Shown as it is.
  const refusal = text(record(data?.error)?.message);
  if (refusal) return { kind: 'failed', message: readerSentence(refusal) };
  // Anything else is a transport failure, never shown in its own words: a
  // lazy row's `error`, the masked "That lookup found nothing…" a reader below
  // researcher gets, a bare "HTTP 500".
  if (text(result?.error)) return { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE };
  if (result?.data == null) {
    // A lazy result still to fetch: the card asks for it.
    if (hasRef) return null;
    // A step stored with no result at all: the run stopped before the quiz
    // was made, so the card says so rather than waiting for ever.
    return { kind: 'failed', message: 'Lawexa stopped before the quiz was made. Ask again to try once more.' };
  }
  return { kind: 'failed', message: QUIZ_TRANSPORT_FAILURE };
}

/**
 * The card's state from a polled job (`GET /quiz-jobs/{uuid}`'s `data.job`):
 * `ready` once done, with the quiz the job carries (backend, 24 October 2026)
 * and the step's source line; `failed` with the job's sentence; `making` while
 * it reads or writes, or while the job has not answered yet.
 */
export function quizJobState(job: unknown, ref: QuizJobRef): CreatedQuiz {
  const polled = record(job);
  const status = polled?.status;
  if (status === 'done') {
    const quiz = readyQuiz(record(polled?.quiz), ref.source);
    if (quiz?.kind === 'ready') {
      // The count asked: the job's own, else the step's.
      const asked = count(polled?.question_count) || ref.questionCount;
      return asked > quiz.questionCount ? { ...quiz, asked } : quiz;
    }
    // Done but sent without the quiz: draw it from the job's own fields.
    const uuid = text(polled?.quiz_uuid);
    if (uuid) return { kind: 'ready', uuid, title: 'Your quiz', questionCount: ref.questionCount, scenarioCount: 0, source: ref.source };
  }
  if (status === 'failed') {
    const sentence = text(record(polled?.error)?.message);
    return { kind: 'failed', message: sentence ? readerSentence(sentence) : QUIZ_TRANSPORT_FAILURE };
  }
  return { kind: 'making' };
}

/** Whether a polled job is finished, so the card stops asking. */
export function quizJobFinished(job: unknown): boolean {
  const status = record(job)?.status;
  return status === 'done' || status === 'failed';
}

/**
 * The step's own label, from the LOADED result (ToolStepItem reads it from the
 * cache the quiz cards fill). A refusal or a failure reads "Couldn't make a
 * quiz", so the row never says "Made a quiz" above a card that says it was
 * not. A quiz in hand reads "Made a quiz". A job, or a result not loaded yet,
 * reads "Started a quiz", true either way: the card under the chain says how
 * it went (a lazy row carries neither the job nor the quiz).
 */
export function createQuizStepAction(isComplete: boolean, result: ToolMessage['toolResult'] | undefined, hasRef: boolean): string {
  if (!isComplete) return 'Making a quiz';
  const state = finishedQuiz(result, hasRef);
  if (state?.kind === 'failed') return "Couldn't make a quiz";
  return state?.kind === 'ready' ? 'Made a quiz' : 'Started a quiz';
}

/** A made quiz's fields as the card draws them, or `null` when it is not one; `source` stands in when it has none. */
function readyQuiz(quiz: Record<string, unknown> | null, source: string | null): CreatedQuiz | null {
  if (!quiz || typeof quiz.uuid !== 'string' || !quiz.uuid || typeof quiz.title !== 'string') return null;
  return {
    kind: 'ready',
    uuid: quiz.uuid,
    title: quiz.title.trim() || 'Your quiz',
    questionCount: count(quiz.question_count),
    scenarioCount: count(quiz.scenario_count),
    source: sourceLine(record(quiz.source)) ?? source,
  };
}

/** "Labour Act, 1974, Part II": the source's title, with a statute's part range when there is one. */
function sourceLine(source: Record<string, unknown> | null): string | null {
  const title = text(source?.title);
  const range = text(source?.range);
  return title ? (range ? `${title}, ${range}` : title) : null;
}

/**
 * A transport error the step carries in place of a sentence: "HTTP 500", a
 * status code, a timeout or a dropped connection. The reader gets
 * {@link QUIZ_TRANSPORT_FAILURE} instead of the code.
 */
const TRANSPORT_ERROR =
  /^(?:HTTP\s*\d{3}\b|\d{3}\b|request failed|network error|timeout|timed out|socket hang up|econn|internal server error|bad gateway|service unavailable|gateway time-?out)/i;

/** The sentence the reader sees: the server's own words, or the plain failure for a transport error. */
export function readerSentence(sentence: string): string {
  return TRANSPORT_ERROR.test(sentence) ? QUIZ_TRANSPORT_FAILURE : sentence;
}

/** A whole count from the server, 0 when it sent none. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** A non-empty trimmed string, or `null`. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** "10 questions · 1 scenario · from TEST DATA tenancy notes.pdf". */
export function createdQuizLine(quiz: Extract<CreatedQuiz, { kind: 'ready' }>): string {
  // Fewer made than asked (backend, 24 October 2026: the job ends after Lawexa
  // has replied, so its answer cannot say so): "8 of the 10 questions asked".
  const parts = [
    quiz.asked !== undefined && quiz.asked > quiz.questionCount
      ? `${quiz.questionCount} of the ${quiz.asked} questions asked`
      : `${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'}`,
  ];
  if (quiz.scenarioCount > 0) parts.push(`${quiz.scenarioCount} ${quiz.scenarioCount === 1 ? 'scenario' : 'scenarios'}`);
  if (quiz.source) parts.push(`from ${quiz.source}`);
  return parts.join(' · ');
}
