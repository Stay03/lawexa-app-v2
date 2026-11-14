import type {
  QuestionCard,
  QuestionCardAnswer,
  QuestionCardAnswers,
  QuestionCardOption,
  QuestionCardQuestion,
} from '@/types/chat';

/**
 * question-card — reading and answering the cards Lawexa asks with (Arthur's
 * go f6eaa156; Backend's shape, 9 November 2026).
 *
 * A card is the turn's final answer, `metadata.type` "question_card": 1 to 4
 * questions of 2 to 4 options each. The reader answers with one POST of the
 * chat: the line they see as `message`, and `question_answers` with one answer
 * per question in order. That user turn comes back as `metadata.type`
 * "question_answers".
 *
 * The readers here refuse a shape they do not know (null), so a card the app
 * cannot draw stays its plain-text answer instead of a broken card.
 */

const MAX_QUESTIONS = 4;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const STATUSES: ReadonlySet<string> = new Set(['open', 'answered', 'skipped']);

/** Joins the parts of the line a reader's answers are sent and shown as. */
export const ANSWER_SEPARATOR = ' · ';

/** The words sent when every question was skipped (the server needs a message). */
export const ALL_SKIPPED_LINE = 'Skipped the questions';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOption(value: unknown): QuestionCardOption | null {
  if (!isRecord(value) || typeof value.label !== 'string' || value.label.trim() === '') return null;
  return { label: value.label, description: typeof value.description === 'string' ? value.description : '' };
}

function readQuestion(value: unknown): QuestionCardQuestion | null {
  if (!isRecord(value) || typeof value.question !== 'string' || !Array.isArray(value.options)) return null;
  if (value.options.length < MIN_OPTIONS || value.options.length > MAX_OPTIONS) return null;
  const options: QuestionCardOption[] = [];
  for (const raw of value.options) {
    const option = readOption(raw);
    if (!option) return null;
    options.push(option);
  }
  return { question: value.question, why: typeof value.why === 'string' ? value.why : '', options, recommended: readRecommended(value, options.length) };
}

/**
 * Which option Lawexa recommends, if any (question cards B, Stay 13 November
 * 2026; Backend's 13566521): the option marked `recommended: true` (at most
 * one), and a question with none has no recommendation and no tag. A card
 * from before that change carries the question's `recommended` index instead,
 * which is still read, so either server answers the same way.
 */
function readRecommended(value: Record<string, unknown>, total: number): number | null {
  const options = value.options as unknown[];
  const marked = options.findIndex((option) => isRecord(option) && option.recommended === true);
  if (marked >= 0) return marked;
  if (options.some((option) => isRecord(option) && 'recommended' in option)) return null;
  const index = value.recommended;
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < total ? index : null;
}

/** One stored or sent answer; null for a shape this app does not know. */
export function readAnswer(value: unknown): QuestionCardAnswer | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === 'string' ? value.label : undefined;
  if (value.skipped === true) return label === undefined ? { skipped: true } : { skipped: true, label };
  if (typeof value.option === 'number' && Number.isInteger(value.option) && value.option >= 0) {
    return label === undefined ? { option: value.option } : { option: value.option, label };
  }
  if (typeof value.text === 'string') return { text: value.text };
  return null;
}

function readAnswers(value: unknown): QuestionCardAnswer[] | null {
  if (!Array.isArray(value)) return null;
  const answers: QuestionCardAnswer[] = [];
  for (const raw of value) {
    const answer = readAnswer(raw);
    if (!answer) return null;
    answers.push(answer);
  }
  return answers;
}

/** A card from an answer's metadata; null when it is not one, or not one this app can draw. */
export function readQuestionCard(metadata: unknown): QuestionCard | null {
  if (!isRecord(metadata) || metadata.type !== 'question_card') return null;
  if (typeof metadata.status !== 'string' || !STATUSES.has(metadata.status)) return null;
  if (!Array.isArray(metadata.questions)) return null;
  if (metadata.questions.length === 0 || metadata.questions.length > MAX_QUESTIONS) return null;
  const questions: QuestionCardQuestion[] = [];
  for (const raw of metadata.questions) {
    const question = readQuestion(raw);
    if (!question) return null;
    questions.push(question);
  }
  const answers = metadata.answers == null ? null : readAnswers(metadata.answers);
  return { status: metadata.status as QuestionCard['status'], questions, answers };
}

/** The answers a user turn sent, from its metadata; null on every other turn. */
export function readCardAnswers(metadata: unknown): QuestionCardAnswers | null {
  if (!isRecord(metadata) || metadata.type !== 'question_answers') return null;
  if (typeof metadata.card_message_id !== 'number') return null;
  const answers = readAnswers(metadata.answers ?? []);
  if (!answers) return null;
  return { cardMessageId: metadata.card_message_id, answers };
}

/** One question's answer in words for the answers' bubble: a skip says what Lawexa went with. */
export function answerForList(question: QuestionCardQuestion | undefined, answer: QuestionCardAnswer): string {
  if (isSkipped(answer)) return answer.label ? `Skipped, Lawexa went with ${answer.label}` : 'Skipped';
  return answerWords(question, answer) ?? '';
}

export function isSkipped(answer: QuestionCardAnswer): answer is { skipped: true; label?: string } {
  return 'skipped' in answer;
}

/** Every question skipped: the card was put aside, nothing was chosen. */
export function allSkipped(answers: readonly QuestionCardAnswer[]): boolean {
  return answers.length > 0 && answers.every(isSkipped);
}

/** What one answer says, in words; null for a skip or an answer with nothing in it. */
export function answerWords(question: QuestionCardQuestion | undefined, answer: QuestionCardAnswer): string | null {
  if (isSkipped(answer)) return null;
  if ('text' in answer) return answer.text.trim() || null;
  return answer.label ?? question?.options[answer.option]?.label ?? null;
}

/**
 * The line the reader's answers are sent as, and the bubble shows when the
 * questions are not at hand: each chosen label or own words, in question
 * order, skips left out.
 */
export function answersLine(questions: readonly QuestionCardQuestion[], answers: readonly QuestionCardAnswer[]): string {
  const words = answers
    .map((answer, index) => answerWords(questions[index], answer))
    .filter((part): part is string => part !== null);
  return words.length === 0 ? ALL_SKIPPED_LINE : words.join(ANSWER_SEPARATOR);
}

/**
 * The answers with each option's and each skip's label, as the server keeps
 * them (Backend's `cardAnswers`: a skip names the recommended option Lawexa
 * goes on with). The reader's own row draws its bubble from these
 * before the server's copy comes back.
 */
export function labeledAnswers(
  questions: readonly QuestionCardQuestion[],
  answers: readonly QuestionCardAnswer[],
): QuestionCardAnswer[] {
  return answers.map((answer, index) => {
    const question = questions[index];
    if ('option' in answer) {
      const label = question?.options[answer.option]?.label;
      return label === undefined ? answer : { option: answer.option, label };
    }
    if (isSkipped(answer)) {
      const label = question && question.recommended !== null ? question.options[question.recommended]?.label : undefined;
      return label === undefined ? { skipped: true } : { skipped: true, label };
    }
    return answer;
  });
}

/**
 * The answers in one line from stored answers alone: each option's label and
 * each own answer, skips left out. Null when an answer names an option
 * without its label, so the row falls back to its own text. The server saves
 * the answering turn's text as the model reads it ("My answers to your
 * questions: 1. … → …"), which is not a line to show.
 */
export function chosenLine(answers: readonly QuestionCardAnswer[]): string | null {
  if ((answers as QuestionCardAnswer[]).some((answer) => 'option' in answer && answer.label === undefined)) return null;
  return answersLine([], answers);
}

/**
 * The answers as one message, in the words the server gives the model for a
 * saved card (Backend's `answersText`). A confidential chat saves no message,
 * so its card has no id to answer by: this is what it sends instead. Facts
 * only, no instruction to the model (Techlead's review, 13 November 2026): a
 * skip reads "skipped (recommended: X)", Backend's exact words.
 */
export function answersMessage(questions: readonly QuestionCardQuestion[], answers: readonly QuestionCardAnswer[]): string {
  const lines = ['My answers to your questions:'];
  questions.forEach((question, index) => {
    const answer = answers[index] ?? { skipped: true };
    const recommended = question.recommended === null ? null : question.options[question.recommended]?.label;
    const words =
      'option' in answer
        ? (question.options[answer.option]?.label ?? '')
        : 'text' in answer
          ? `my own answer: ${answer.text}`
          : recommended
            ? `skipped (recommended: ${recommended})`
            : 'skipped';
    lines.push(`${index + 1}. ${question.question} → ${words}`);
  });
  return lines.join('\n');
}

/**
 * The answer a question starts with on an open card: the recommended option,
 * so Next alone takes Lawexa's suggestion. A question with none starts empty.
 */
export function startingAnswer(question: QuestionCardQuestion): QuestionCardAnswer | null {
  return question.recommended === null ? null : { option: question.recommended };
}

/** The option a question's choice names, or `null` for none (nothing chosen, or own words). */
export function chosenAt(draft: QuestionCardAnswer | null): number | null {
  return draft !== null && 'option' in draft ? draft.option : null;
}

/**
 * Where a key moves the choice in a question's options, as a radio group
 * does: ArrowDown and ArrowRight to the next (round to the first), ArrowUp
 * and ArrowLeft to the one before (round to the last), Home and End to the
 * ends. From no choice, the next is the first and the one before the last.
 * `null` for any other key.
 */
export function optionKeyTarget(key: string, from: number | null, total: number): number | null {
  if (total <= 0) return null;
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return from === null ? 0 : (from + 1) % total;
    case 'ArrowUp':
    case 'ArrowLeft':
      return from === null ? total - 1 : (from - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

/**
 * How the message box reads while it takes the answer to question `at` of
 * `count` (question cards, design A V3: the box is the field for "Something
 * else"): its hint names the question, and its arrow is "Next", or "Send" on
 * the last question.
 */
export interface BoxAnswering {
  placeholder: string;
  submitLabel: 'Next' | 'Send';
}

export function boxAnsweringFor(at: number, count: number): BoxAnswering {
  return {
    // Short, so it keeps one line in a phone's box (Techlead, 14 November 2026).
    placeholder: count > 1 ? `Your answer to question ${at + 1}` : 'Your answer',
    submitLabel: at >= count - 1 ? 'Send' : 'Next',
  };
}

/** Every question answered as skipped: the × on the card. */
export function skipAllAnswers(questions: readonly QuestionCardQuestion[]): QuestionCardAnswer[] {
  return questions.map(() => ({ skipped: true }) as const);
}

/**
 * The answers to send: what the reader picked or wrote for each question, and
 * a skip where they gave nothing (own words left empty count as nothing).
 */
export function answersToSend(
  questions: readonly QuestionCardQuestion[],
  drafts: readonly (QuestionCardAnswer | null)[],
): QuestionCardAnswer[] {
  return questions.map((_question, index) => {
    const draft = drafts[index] ?? null;
    if (draft === null) return { skipped: true };
    if ('text' in draft && draft.text.trim() === '') return { skipped: true };
    if ('text' in draft) return { text: draft.text.trim() };
    if ('option' in draft) return { option: draft.option };
    return { skipped: true };
  });
}

/** A card's status after the reader's own turn closed it: answered, or skipped when they typed instead. */
export function closedCard(card: QuestionCard, answers: readonly QuestionCardAnswer[] | null): QuestionCard {
  return answers === null
    ? { ...card, status: 'skipped' }
    : { ...card, status: 'answered', answers: [...answers] };
}
