/**
 * question-feedback — "Report a problem" on one quiz question (Arthur, 26
 * October 2026; thread 87b8e449): what the reader may tick, and the request
 * the report sends (Backend's contract, the same day).
 *
 * ONE QUESTION, THREE HOMES. A question reported from a practice session, from
 * an authored or AI-made quiz (solo, or a channel game's), or from a quiz card
 * inside a chat answer. Each names its question differently (`content_type`
 * and its id), and the context carries what the reader saw: the question, the
 * option they picked and the one shown as correct, so a later edit to the
 * question does not change what the report is about.
 *
 * THE REASONS ARE THE SERVER'S (`context.reasons`), in the server's own
 * words, so the form, the team's email and the author's notice read alike. A report needs a reason or some words; the words go as
 * `feedback_text`, which the server takes as optional when a reason is ticked.
 *
 * Pure, so the test can run it; `QuestionFeedbackButton` draws it.
 */

import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import type { QuizFeedbackReason, QuizQuestionFeedbackBody } from '@/types/feedback';

export const QUIZ_FEEDBACK_REASONS: readonly { id: QuizFeedbackReason; label: string }[] = [
  { id: 'wrong_answer', label: 'The answer marked correct is wrong' },
  { id: 'unclear_question', label: 'The question is unclear' },
  { id: 'typo', label: 'Typo or wording' },
  { id: 'outdated_law', label: 'The law has changed' },
  { id: 'other', label: 'Something else' },
];

/** The server's limits on what a report carries. */
export const QUIZ_FEEDBACK_TEXT_MAX = 5000;
const QUESTION_TEXT_MAX = 2000;
const OPTION_TEXT_MAX = 1000;

export type { QuizFeedbackReason };

/** Which question is reported, by where it was played. */
export type QuizFeedbackTarget =
  /** A practice session's question (the practice bank). */
  | { kind: 'practice'; questionUuid: string; sessionUuid: string }
  /** A question of an authored or AI-made quiz, played solo or in a channel. */
  | { kind: 'quiz'; questionUuid: string; quizUuid: string; attemptUuid: string | null }
  /** A quiz card inside a chat answer: the saved answer and the card's place in it. */
  | { kind: 'chat'; messageId: number; quizIndex: number };

/** What the reader saw when they reported it. */
export interface QuizFeedbackSnapshot {
  /** The question's 0-based place, as the API gives it (Backend, 26 October
   *  2026: `ChannelQuizQuestion.position`); `null` when it has none. */
  position: number | null;
  questionText: string;
  /** The text of the option the reader picked; `null` when they picked none. */
  chosenOption: string | null;
  /** The text of the option shown as correct; `null` when none was shown. */
  correctOption: string | null;
}

/** Why the report cannot go yet, or `null` when it can. */
export function quizFeedbackRefusal(reasons: readonly QuizFeedbackReason[], details: string): string | null {
  return reasons.length === 0 && !details.trim() ? 'Tick a reason or tell us in your own words.' : null;
}

/** The request body for one report. */
export function quizFeedbackBody(
  target: QuizFeedbackTarget,
  snapshot: QuizFeedbackSnapshot,
  reasons: readonly QuizFeedbackReason[],
  details: string,
): QuizQuestionFeedbackBody {
  const words = details.trim().slice(0, QUIZ_FEEDBACK_TEXT_MAX);
  const context: QuizQuestionFeedbackBody['context'] = {
    // In the order the form lists them, once each.
    reasons: QUIZ_FEEDBACK_REASONS.map((reason) => reason.id).filter((id) => reasons.includes(id)),
    question_text: snapshot.questionText.trim().slice(0, QUESTION_TEXT_MAX),
  };
  if (snapshot.position !== null) context.position = snapshot.position;
  const chosen = snapshot.chosenOption?.trim();
  if (chosen) context.chosen_option = chosen.slice(0, OPTION_TEXT_MAX);
  const correct = snapshot.correctOption?.trim();
  if (correct) context.correct_option = correct.slice(0, OPTION_TEXT_MAX);

  const named = (() => {
    switch (target.kind) {
      case 'practice':
        context.session_uuid = target.sessionUuid;
        return { content_type: 'quiz_question' as const, content_uuid: target.questionUuid };
      case 'quiz':
        context.quiz_uuid = target.quizUuid;
        if (target.attemptUuid) context.attempt_uuid = target.attemptUuid;
        return { content_type: 'channel_quiz_question' as const, content_uuid: target.questionUuid };
      case 'chat':
        context.quiz_index = target.quizIndex;
        return { content_type: 'message' as const, content_id: target.messageId };
    }
  })();

  return { ...(words ? { feedback_text: words } : {}), ...named, context };
}

/**
 * What the reader saw of a solo attempt's question: its text, the option they
 * picked and the one the reveal showed as right, at its own `position`.
 */
export function attemptQuestionSnapshot(
  question: Pick<QuizAttemptQuestion, 'question' | 'options' | 'your_option_id' | 'correct_option_id' | 'position'>,
): QuizFeedbackSnapshot {
  const text = (id: number | null | undefined) =>
    id === null || id === undefined ? null : (question.options.find((option) => option.id === id)?.content ?? null);
  return {
    position: question.position,
    questionText: question.question,
    chosenOption: text(question.your_option_id),
    correctOption: text(question.correct_option_id),
  };
}
