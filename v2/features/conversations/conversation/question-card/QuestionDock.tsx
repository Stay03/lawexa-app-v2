'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { PenLine, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { answersToSend, chosenAt, optionKeyTarget, skipAllAnswers, startingAnswer } from '@/lib/utils/question-card';
import type { QuestionCardAnswer } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules/meta';
import type { OpenCard } from './open-card';

/** The message box's hint while Lawexa's questions wait: a typed reply goes instead of the answers. */
export const CARD_ANSWER_PLACEHOLDER = 'Or type a different answer';

/** The longest own answer the server takes for one question (Backend's 13566521). */
export const OTHER_ANSWER_MAX = 2000;

type QuestionDockProps = {
  open: OpenCard;
  /** Nothing can be sent yet (the chat loads, a turn runs, another member's turn holds it). */
  held: boolean;
  /** Send the answers; resolves with the refusal's sentence, or null when they went. */
  onAnswer: (answers: QuestionCardAnswer[]) => Promise<string | null>;
  /** "Something else" has the keyboard: the host hides its own box, so there is one place to type. */
  onTypingChange: (typing: boolean) => void;
};

/**
 * QuestionDock — Lawexa's questions on a card docked above the message box
 * (question cards, design A: Stay, 13 November 2026, c91086ec: "lets just use
 * this and use it well"). Lawexa's own words stay in the chat above it.
 *
 * One question at a time, with dots for the steps; a dot of a question already
 * passed goes back to it. Each question starts on the option the server marks
 * recommended, or on nothing when none is (Backend's 13566521: a mark only
 * when Lawexa has a reason). A tap selects; Next confirms, and on the last
 * question sends every answer in one go. Skip leaves the question unanswered
 * and moves on (on the last, it sends). × skips them all.
 *
 * "Something else" turns its own row into a one-line field in place, and the
 * box under the card steps away while that field has the keyboard: one place
 * to type, ever. Its words are that question's answer.
 *
 * On a phone the card is capped at 60% of the screen and scrolls inside, and
 * it sits on the box, which the app keeps above the keyboard.
 *
 * Keyed by the card by its host, so a new card starts fresh.
 */
export function QuestionDock({ open, held, onAnswer, onTypingChange }: QuestionDockProps) {
  const { questions } = open.card;
  const count = questions.length;
  const [index, setIndex] = useState(0);
  // The furthest question reached: the dots up to it go back.
  const [reached, setReached] = useState(0);
  const [drafts, setDrafts] = useState<(QuestionCardAnswer | null)[]>(() => questions.map(startingAnswer));
  // What the reader typed for each question, kept while they look at the options.
  const [ownWords, setOwnWords] = useState<string[]>(() => questions.map(() => ''));
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const ownRef = useRef<HTMLInputElement>(null);

  const question = questions[index];
  const draft = drafts[index] ?? null;
  const optionCount = question.options.length;
  const ownChosen = draft !== null && 'text' in draft;
  // A choice by its place in the radio group: an option's index, or the place after them for "Something else".
  const choiceAt = ownChosen ? optionCount : chosenAt(draft);
  const isLast = index === count - 1;
  const locked = held || sending;

  const setDraft = (answer: QuestionCardAnswer | null) =>
    setDrafts((current) => current.map((entry, at) => (at === index ? answer : entry)));

  const send = async (answers: QuestionCardAnswer[]) => {
    if (locked) return;
    onTypingChange(false);
    setSending(true);
    setRefused(null);
    const sentence = await onAnswer(answers);
    // Sent: the card closes with the chat's next render. Refused: it stays, choices kept, with the reason.
    setSending(false);
    setRefused(sentence);
  };

  const goTo = (at: number) => {
    onTypingChange(false);
    setIndex(at);
    setReached((furthest) => Math.max(furthest, at));
  };

  const next = (current: (QuestionCardAnswer | null)[] = drafts) => {
    if (locked) return;
    if (isLast) void send(answersToSend(questions, current));
    else goTo(index + 1);
  };

  const skip = () => {
    if (locked) return;
    const current = drafts.map((entry, at) => (at === index ? null : entry));
    setDrafts(current);
    next(current);
  };

  const choose = (choice: number) => {
    if (locked) return;
    if (choice === optionCount) {
      setDraft({ text: ownWords[index] });
      // The field mounts with this render; it takes the keyboard once it is there.
      requestAnimationFrame(() => ownRef.current?.focus({ preventScroll: true }));
      return;
    }
    setDraft({ option: choice });
  };

  const typeOwn = (text: string) => {
    setOwnWords((current) => current.map((entry, at) => (at === index ? text : entry)));
    setDraft({ text });
  };

  // The choices as a radio group for the keyboard: Tab reaches the chosen one,
  // the arrow keys (and Home, End) move the choice. Nothing is sent; Next does.
  const onChoiceKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked || !(event.target instanceof HTMLButtonElement)) return;
    const target = optionKeyTarget(event.key, choiceAt, optionCount + 1);
    if (target === null) return;
    event.preventDefault();
    choose(target);
    if (target < optionCount) event.currentTarget.querySelector<HTMLButtonElement>(`[data-option="${target}"]`)?.focus();
  };

  return (
    <section
      aria-label="Lawexa's questions"
      className="mb-2 flex max-h-[60dvh] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
        {count > 1 ? (
          <div className="flex items-center gap-1.5" role="group" aria-label={`Question ${index + 1} of ${count}`}>
            {questions.map((step, at) => (
              <button
                key={at}
                type="button"
                aria-label={`Question ${at + 1}: ${step.question}`}
                aria-current={at === index ? 'step' : undefined}
                disabled={locked || at > reached || at === index}
                onClick={() => goTo(at)}
                className={cn(
                  'v2-interactive h-1.5 rounded-full transition-all disabled:cursor-default',
                  at === index ? 'w-4 bg-primary' : at <= reached ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border',
                  FOCUS_RING,
                )}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-label={count > 1 ? 'Skip all questions' : 'Skip the question'}
          disabled={locked}
          onClick={() => void send(skipAllAnswers(questions))}
          className={cn('v2-interactive -mr-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40', FOCUS_RING)}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-2">
        <p className="text-[15px] font-semibold leading-snug text-foreground">{question.question}</p>
        {question.why && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{question.why}</p>}
        <div
          role="radiogroup"
          aria-label={question.question}
          onKeyDown={onChoiceKey}
          className="mt-2.5 flex flex-col gap-0.5"
        >
          {question.options.map((option, at) => {
            const chosen = choiceAt === at;
            return (
              <button
                key={`${index}-${at}`}
                type="button"
                role="radio"
                aria-checked={chosen}
                // One stop for Tab: the chosen choice, or the first when none is.
                tabIndex={at === (choiceAt ?? 0) ? 0 : -1}
                data-option={at}
                disabled={locked}
                onClick={() => choose(at)}
                className={cn(
                  'v2-interactive flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors disabled:cursor-default',
                  chosen ? 'bg-muted' : 'hover:bg-muted/60',
                  FOCUS_RING,
                )}
              >
                <Radio on={chosen} />
                <span className="min-w-0 flex-1">
                  {/* The tag rides after the label, and wraps under it where the label would not keep its line. */}
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[14.5px] font-medium leading-snug text-foreground">{option.label}</span>
                    {question.recommended === at && <span className="text-[12px] font-medium text-primary">Recommended</span>}
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{option.description}</span>
                  )}
                </span>
              </button>
            );
          })}
          {ownChosen ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted px-2.5 py-1.5">
              <PenLine aria-hidden className="size-[18px] shrink-0 text-primary" />
              <input
                ref={ownRef}
                value={ownWords[index]}
                onChange={(event) => typeOwn(event.target.value)}
                onFocus={() => onTypingChange(true)}
                onBlur={() => onTypingChange(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    next();
                  }
                }}
                disabled={locked}
                maxLength={OTHER_ANSWER_MAX}
                enterKeyHint={isLast ? 'send' : 'next'}
                placeholder="Type your answer"
                aria-label={`Your own answer: ${question.question}`}
                className="min-w-0 flex-1 bg-transparent py-0.5 text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          ) : (
            <button
              type="button"
              role="radio"
              aria-checked={false}
              tabIndex={choiceAt === optionCount ? 0 : -1}
              data-option={optionCount}
              disabled={locked}
              onClick={() => choose(optionCount)}
              className={cn(
                'v2-interactive flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14.5px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-default',
                FOCUS_RING,
              )}
            >
              <PenLine aria-hidden className="size-[18px] shrink-0" />
              Something else
            </button>
          )}
        </div>
        {refused && (
          <p role="alert" className="mt-2 px-1 text-[13px] text-destructive">
            {refused}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 px-4 pt-2 pb-3">
        <button
          type="button"
          disabled={locked}
          onClick={skip}
          className={cn('v2-interactive rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50', FOCUS_RING)}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => next()}
          className={cn('v2-interactive rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50', FOCUS_RING)}
        >
          {isLast ? (sending ? 'Sending…' : 'Send') : 'Next'}
        </button>
      </div>
    </section>
  );
}

/** A radio circle: filled in the brand colour when chosen. */
function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
        on ? 'border-primary' : 'border-muted-foreground/40',
      )}
    >
      {on && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}
