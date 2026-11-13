'use client';

import { cn } from '@/lib/utils';
import { allSkipped, answerForList, chosenLine } from '@/lib/utils/question-card';
import type { QuestionCard, QuestionCardAnswers } from '@/types/chat';
import { useV2ChatContext } from '../chat-context';
import { InlineQuestions } from './InlineQuestions';

/**
 * Lawexa's answer that asks questions (question cards, design B: Arthur's
 * pick, 13 November 2026). Its saved text is the questions in plain words
 * (for v1 and a copy); the row draws them instead. While the card is open and
 * this reader may answer, the questions are answered right here
 * ({@link InlineQuestions}); a reader who may not (a viewer, a shared link)
 * sees them as a list. Once answered, only the lead line stays: the reader's
 * answers come next, as their own bubble ({@link CardAnswersBubble}). A card
 * put aside for a typed reply says so.
 */
export function AskedQuestions({ rowId, card }: { rowId: string; card: QuestionCard }) {
  const chat = useV2ChatContext();
  const count = card.questions.length;
  const lead = count === 1 ? 'I have a question before I go on.' : 'I have a few questions before I go on.';
  const answering = card.status === 'open' && chat?.cardQuestions?.open.rowId === rowId ? chat.cardQuestions : null;
  return (
    <div className="text-[15px] leading-relaxed text-foreground">
      <p>{lead}</p>
      {answering ? (
        <InlineQuestions cardQuestions={answering} />
      ) : card.status === 'open' ? (
        <ol className="mt-3 flex flex-col gap-2.5">
          {card.questions.map((question, at) => (
            <li key={at} className="flex items-start gap-2.5 px-1 text-[14px] leading-snug text-muted-foreground">
              <span
                aria-hidden
                className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px]"
              >
                {at + 1}
              </span>
              {question.question}
            </li>
          ))}
        </ol>
      ) : card.status === 'skipped' ? (
        <p className="mt-1 text-[13px] text-muted-foreground">
          {count === 1 ? 'The question was skipped for a typed reply.' : 'The questions were skipped for a typed reply.'}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The reader's answers to a card, as their own bubble: each question with its
 * answer, side by side on a computer and stacked on a phone; a skip names the
 * option Lawexa went with. The questions ride on the answers (the card in the
 * chat read, or the reader's own send); without them the bubble holds the
 * chosen labels in one line (`chosenLine`), else the row's text. The server
 * saves the answering turn's text as the model reads it, a numbered list,
 * which is not a line to show.
 */
export function CardAnswersBubble({
  answers,
  content,
  ground,
}: {
  answers: QuestionCardAnswers;
  content: string;
  /** The bubble's colour, as the row's other bubbles (the member's tint in a space chat). */
  ground: string;
}) {
  const bubble = cn(ground, 'max-w-full rounded-3xl px-4 py-3 text-[14px] leading-snug text-foreground break-words');
  if (allSkipped(answers.answers)) {
    return <p className={cn(bubble, 'text-muted-foreground')}>Skipped the questions</p>;
  }
  const { questions } = answers;
  if (!questions) {
    return <p className={cn(bubble, 'whitespace-pre-wrap')}>{chosenLine(answers.answers) ?? content}</p>;
  }
  return (
    <ol aria-label="Answers to Lawexa's questions" className={cn(bubble, 'flex flex-col gap-1.5')}>
      {questions.map((question, at) => {
        const answer = answers.answers[at];
        return (
          <li key={at} className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
            <span className="min-w-0 text-muted-foreground">{question.question}</span>
            <span className="font-medium sm:ml-auto sm:max-w-[45%] sm:shrink-0 sm:text-right">
              {answer ? answerForList(question, answer) : 'Skipped'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
