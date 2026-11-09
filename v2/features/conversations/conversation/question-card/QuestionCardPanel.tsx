'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, PenLine, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { answersToSend, skipAllAnswers, startingAnswer } from '@/lib/utils/question-card';
import type { QuestionCardAnswer } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules/meta';
import type { OpenCard } from './open-card';

/**
 * QuestionCardPanel — Lawexa's questions, above the message box (Arthur's go
 * f6eaa156; picture approved 9 November 2026 with the star taken off
 * "Recommended").
 *
 * One question at a time: "2 of 4" with back and next, and × to skip them all.
 * Each starts on the recommended option, so Next alone takes Lawexa's pick.
 * A tap on an option chooses it and moves on (the last waits for Send).
 * "Something else…" takes the reader's own words; Skip leaves a question
 * unanswered, and Lawexa goes with its recommendation. The box under the card
 * stays usable: a typed reply puts the card aside (the server marks it skipped).
 *
 * All the answers go in one send, as the line the reader sees afterwards
 * ("Firm but polite · 14-day deadline") with the answers beside it
 * (`question_answers`). A refusal (the card was closed meanwhile, another
 * member's turn) is said in the card, and the choices stay.
 *
 * Keyed by the card's saved id where it is drawn, so a new card starts fresh.
 */
export function QuestionCardPanel({
  open,
  disabled,
  onAnswer,
}: {
  open: OpenCard;
  /** A turn is running or the chat is still loading: nothing can be sent yet. */
  disabled: boolean;
  /** Send the answers; resolves with the refusal's sentence, or null when they went. */
  onAnswer: (answers: QuestionCardAnswer[]) => Promise<string | null>;
}) {
  const { questions } = open.card;
  const count = questions.length;
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<(QuestionCardAnswer | null)[]>(() => questions.map(startingAnswer));
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const question = questions[index];
  const draft = drafts[index] ?? null;
  const isLast = index === count - 1;
  const writing = draft !== null && 'text' in draft;
  const locked = disabled || sending;

  const setDraft = (answer: QuestionCardAnswer | null) =>
    setDrafts((current) => current.map((entry, at) => (at === index ? answer : entry)));

  const send = async (answers: QuestionCardAnswer[]) => {
    if (locked) return;
    setSending(true);
    setRefused(null);
    const sentence = await onAnswer(answers);
    // Sent: the card closes with the chat's next render. Refused: it stays,
    // choices kept, with the reason.
    setSending(false);
    setRefused(sentence);
  };

  const advance = (nextDrafts: (QuestionCardAnswer | null)[]) => {
    if (isLast) void send(answersToSend(questions, nextDrafts));
    else setIndex(index + 1);
  };

  const choose = (option: number) => {
    if (locked) return;
    const next = drafts.map((entry, at) => (at === index ? { option } : entry));
    setDrafts(next);
    // One tap answers and moves on; on the last question Send confirms.
    if (!isLast) setIndex(index + 1);
  };

  const skip = () => {
    if (locked) return;
    const next = drafts.map((entry, at) => (at === index ? null : entry));
    setDrafts(next);
    advance(next);
  };

  const writeOwn = () => {
    if (locked) return;
    if (!writing) setDraft({ text: '' });
    // The field mounts with this render; focus it once it is there.
    requestAnimationFrame(() => textRef.current?.focus());
  };

  return (
    <section
      aria-label="Lawexa needs your input"
      className="mb-2 rounded-3xl border border-border bg-card p-3 shadow-sm md:p-4"
    >
      <div className="flex flex-col-reverse gap-1 px-1 pb-2 md:flex-row md:items-start md:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-snug text-foreground">{question.question}</p>
          {question.why && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{question.why}</p>}
        </div>
        <div className="-mr-1 flex shrink-0 items-center justify-end gap-0.5 text-muted-foreground">
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous question"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
                className={cn('v2-interactive rounded-md p-1.5 hover:bg-muted hover:text-foreground disabled:opacity-40', FOCUS_RING)}
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-0.5 text-[13px] tabular-nums">
                {index + 1} of {count}
              </span>
              <button
                type="button"
                aria-label="Next question"
                disabled={isLast}
                onClick={() => setIndex(index + 1)}
                className={cn('v2-interactive rounded-md p-1.5 hover:bg-muted hover:text-foreground disabled:opacity-40', FOCUS_RING)}
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label={count > 1 ? 'Skip all questions' : 'Skip the question'}
            title="Skip"
            disabled={locked}
            onClick={() => void send(skipAllAnswers(questions))}
            className={cn('v2-interactive ml-1 rounded-md p-1.5 hover:bg-muted hover:text-foreground disabled:opacity-40', FOCUS_RING)}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div role="radiogroup" aria-label={question.question} className="flex flex-col gap-1">
        {question.options.map((option, at) => {
          const chosen = draft !== null && 'option' in draft && draft.option === at;
          return (
            <button
              key={`${index}-${at}`}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={locked}
              onClick={() => choose(at)}
              className={cn(
                'v2-interactive flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors disabled:cursor-default',
                chosen ? 'bg-secondary ring-[1.5px] ring-primary' : 'hover:bg-muted/60',
                FOCUS_RING,
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-medium',
                  chosen ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {chosen ? <Check className="size-3.5" strokeWidth={2.4} /> : at + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-foreground">
                  {option.label}
                  {question.recommended === at && (
                    <span className="rounded-full border border-primary px-2 py-px text-[11px] font-medium text-primary">
                      Recommended
                    </span>
                  )}
                </span>
                {option.description && (
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{option.description}</span>
                )}
              </span>
              {chosen && <ArrowRight aria-hidden className="mt-1.5 size-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-center gap-3 border-t border-border px-3 pt-3">
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg',
            writing ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
          )}
        >
          <PenLine className="size-3.5" />
        </span>
        {writing ? (
          <textarea
            ref={textRef}
            rows={1}
            value={draft.text}
            disabled={locked}
            aria-label="Your own answer"
            placeholder="Type your answer"
            onChange={(event) => setDraft({ text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                advance(drafts);
              }
            }}
            className="field-sizing-content max-h-32 min-w-0 flex-1 resize-none bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <button
            type="button"
            disabled={locked}
            onClick={writeOwn}
            className={cn('v2-interactive min-w-0 flex-1 rounded-md text-left text-[15px] text-muted-foreground hover:text-foreground', FOCUS_RING)}
          >
            Something else…
          </button>
        )}
        <button
          type="button"
          disabled={locked}
          onClick={skip}
          className={cn('v2-interactive rounded-full bg-secondary px-3.5 py-1.5 text-sm font-medium text-foreground disabled:opacity-50', FOCUS_RING)}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => advance(drafts)}
          className={cn(
            'v2-interactive rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50',
            FOCUS_RING,
          )}
        >
          {isLast ? (sending ? 'Sending…' : 'Send') : 'Next'}
        </button>
      </div>

      {refused && (
        <p role="alert" className="px-3 pt-2 text-[13px] text-destructive">
          {refused}
        </p>
      )}
    </section>
  );
}
