'use client';

import { Check } from 'lucide-react';

import { allSkipped, chosenLine } from '@/lib/utils/question-card';
import type { QuestionCard, QuestionCardAnswers } from '@/types/chat';

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
 */
export function CardAnswersLine({
  answers,
  content,
  who,
}: {
  answers: QuestionCardAnswers;
  content: string;
  /** Null for the reader's own answers ("You"); else the member's name. */
  who: string | null;
}) {
  const skippedAll = allSkipped(answers.answers);
  const subject = who ?? 'You';
  const line = chosenLine(answers.answers) ?? content;
  return (
    <div className="flex min-w-0">
      {/* Wraps rather than cuts: the choices are the reader's record of what they told Lawexa. */}
      <div className="inline-flex min-w-0 max-w-full items-start gap-2 rounded-2xl border border-border px-3 py-1.5 text-[13px] leading-snug text-muted-foreground">
        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
        {skippedAll ? (
          <span>{subject} skipped the questions</span>
        ) : (
          <span className="min-w-0 break-words">
            {subject} chose: <span className="text-foreground">{line}</span>
          </span>
        )}
      </div>
    </div>
  );
}
