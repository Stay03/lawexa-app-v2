'use client';

import { useId, useState } from 'react';
import { Check, ChevronDown, PenLine } from 'lucide-react';

import { cn } from '@/lib/utils';
import { allSkipped, answerForList, chosenLine } from '@/lib/utils/question-card';
import type { QuestionCard, QuestionCardAnswers } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules/meta';
import { useV2ChatContext } from '../chat-context';

/**
 * The marks a question card leaves in the transcript (Arthur's picture,
 * approved 9 November 2026). The card itself sits above the message box
 * (`QuestionCardPanel`); in the transcript, where Lawexa asked, a small gold
 * "Needs your input" while it is open, and a quiet grey line once it was put
 * aside for a typed reply. An answered card leaves nothing here: the reader's
 * answer right under it says what was chosen ({@link CardAnswersLine}).
 */
export function CardMark({ card }: { card: QuestionCard }) {
  if (card.status === 'open') {
    return (
      <div className="flex items-center gap-2 pt-1">
        <span aria-hidden className="relative flex size-2.5">
          <span className="absolute inline-flex size-full rounded-full bg-primary opacity-40 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-primary">Needs your input</span>
      </div>
    );
  }
  if (card.status === 'skipped') {
    const count = card.questions.length;
    return (
      <p className="text-xs text-muted-foreground">
        {count === 1 ? 'Lawexa asked a question' : `Lawexa asked ${count} questions`} · skipped
      </p>
    );
  }
  return null;
}

/**
 * The reader's answers to a card, drawn in place of a bubble: "✓ You chose:
 * Firm but polite · 14-day deadline". The line comes from the answers' own
 * labels (`chosenLine`): the server saves the turn's text as the model reads
 * it, a numbered list, not this line. Only answers without labels fall back
 * to the text. In a space chat another member's answers name them.
 *
 * A tap opens each question with its answer (Arthur, 05650d00), when the
 * card's questions are known. On the latest answered card's line, "Change
 * answers" opens the card again on these answers; changed answers read "You
 * changed: …". Lawexa's reply to the earlier answers stays above.
 */
export function CardAnswersLine({
  rowId,
  answers,
  content,
  who,
}: {
  /** This row's id: the one line that offers Change answers is named by it. */
  rowId: string;
  answers: QuestionCardAnswers;
  content: string;
  /** Null for the reader's own answers ("You"); else the member's name. */
  who: string | null;
}) {
  const [open, setOpen] = useState(false);
  const chat = useV2ChatContext();
  const skippedAll = allSkipped(answers.answers);
  const subject = who ?? 'You';
  const line = chosenLine(answers.answers) ?? content;
  const questions = answers.questions ?? null;
  // Only the reader's own line, on the latest answered card, and not while a turn runs.
  const change =
    who === null && chat && !chat.isStreaming && chat.changeCardAnswers?.rowId === rowId ? chat.changeCardAnswers : null;
  const listId = useId();
  const words = skippedAll ? (
    <span>{subject} skipped the questions</span>
  ) : (
    <span className="min-w-0 break-words">
      {subject} {answers.amend ? 'changed' : 'chose'}: <span className="text-foreground">{line}</span>
    </span>
  );
  const pill =
    'inline-flex min-w-0 max-w-full items-start gap-2 rounded-2xl border border-border px-3 py-1.5 text-left text-[13px] leading-snug text-muted-foreground';
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      {/* Wraps rather than cuts: the choices are the reader's record of what they told Lawexa. */}
      {questions ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((shown) => !shown)}
          className={cn(pill, 'v2-interactive transition-colors hover:bg-muted/60', FOCUS_RING)}
        >
          <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {words}
          <ChevronDown
            aria-hidden
            className={cn('mt-0.5 size-3.5 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          />
        </button>
      ) : (
        <div className={pill}>
          <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {words}
        </div>
      )}
      {questions && open && (
        <ol id={listId} className="ml-1 flex max-w-full flex-col gap-1.5 border-l border-border pl-3 text-[13px] leading-snug">
          {questions.map((question, index) => {
            const answer = answers.answers[index];
            return (
              <li key={index} className="min-w-0 break-words">
                <span className="text-muted-foreground">{question.question}</span>
                <span className="block text-foreground">{answer ? answerForList(question, answer) : 'Skipped'}</span>
              </li>
            );
          })}
        </ol>
      )}
      {change && (
        <button
          type="button"
          onClick={change.start}
          className={cn(
            'v2-interactive flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <PenLine aria-hidden className="size-3.5" />
          Change answers
        </button>
      )}
    </div>
  );
}
