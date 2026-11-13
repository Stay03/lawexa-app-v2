'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Check, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { answersToSend, answerWords, chosenAt, optionKeyTarget, startingAnswer } from '@/lib/utils/question-card';
import type { QuestionCardAnswer } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules/meta';
import type { CardQuestions } from '../chat-context';

/** The message box's hint while Lawexa's questions wait: a typed reply goes instead of the answers. */
export const CARD_ANSWER_PLACEHOLDER = 'Or type a different answer';

/**
 * InlineQuestions — Lawexa's questions inside its own answer, where it asked
 * (question cards, design B: Arthur's pick, 13 November 2026, thread
 * c91086ec). No card over the message box.
 *
 * One question is open at a time, as a bordered block with its options; each
 * starts on the recommended one, so Next alone takes Lawexa's pick. A tap on
 * an option selects it, and Next (Send on the last) confirms. An answered
 * question folds to a tick and its choice, and a tap on it opens it again;
 * the questions still to come are grey numbered lines. "Skip the rest" sends
 * what was chosen so far and skips this question and the later ones ("Skip
 * and send" on the last, "Skip" when there is one); Lawexa goes with its
 * recommendation for each skip.
 *
 * Nothing goes until Send or "Skip the rest". The answers go in one send; a
 * refusal (the card was closed meanwhile, another member's turn) is said under
 * the questions, and the choices stay. Answers cannot be changed after Send
 * (Stay, 12 November): to change something, the reader tells Lawexa.
 *
 * Keyed by the card, so a new card starts fresh.
 */
export function InlineQuestions({ cardQuestions }: { cardQuestions: CardQuestions }) {
  const { open } = cardQuestions;
  return <Questions key={open.cardMessageId ?? open.rowId} {...cardQuestions} />;
}

function Questions({ open, answer, held }: CardQuestions) {
  const { questions } = open.card;
  const count = questions.length;
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<(QuestionCardAnswer | null)[]>(() => questions.map(startingAnswer));
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  const isLast = index === count - 1;
  const locked = held || sending;

  // Moving to another question puts the keyboard on it.
  const goTo = (at: number) => {
    setIndex(at);
    requestAnimationFrame(() => currentRef.current?.focus({ preventScroll: true }));
  };

  const send = async (answers: QuestionCardAnswer[]) => {
    if (locked) return;
    setSending(true);
    setRefused(null);
    const sentence = await answer(answers);
    // Sent: the questions fold away with the chat's next render. Refused:
    // they stay, choices kept, with the reason.
    setSending(false);
    setRefused(sentence);
  };

  const choose = (option: number) => {
    if (locked) return;
    setDrafts((current) => current.map((entry, at) => (at === index ? { option } : entry)));
  };

  const next = () => {
    if (isLast) void send(answersToSend(questions, drafts));
    else goTo(index + 1);
  };

  // The options as a radio group for the keyboard: Tab reaches the chosen
  // one, the arrow keys (and Home, End) move the choice and the focus with
  // it, as a radio group does. Nothing is sent; Next or Send still confirms.
  const onOptionKey = (event: KeyboardEvent<HTMLDivElement>, total: number, from: number | null) => {
    if (locked) return;
    const target = optionKeyTarget(event.key, from, total);
    if (target === null) return;
    event.preventDefault();
    choose(target);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-option="${target}"]`)?.focus();
  };

  const skipRest = () => void send(answersToSend(questions, drafts.map((draft, at) => (at < index ? draft : null))));

  return (
    <div className="mt-3">
      <ol className="flex flex-col gap-2.5">
        {questions.map((question, at) => {
          if (at < index) {
            const words = drafts[at] ? answerWords(question, drafts[at]) : null;
            return (
              <li key={at}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => goTo(at)}
                  aria-label={`${question.question} ${words ?? 'Skipped'}. Change this answer`}
                  className={cn(
                    'v2-interactive flex w-full items-start gap-2.5 rounded-xl px-1 py-1 text-left text-[14px] leading-snug transition-colors hover:bg-muted/60 disabled:hover:bg-transparent',
                    FOCUS_RING,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-px flex size-5 shrink-0 items-center justify-center rounded-full',
                      words ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground',
                    )}
                  >
                    {words ? <Check className="size-3" strokeWidth={2.6} /> : <Minus className="size-3" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-x-2">
                    <span className="text-muted-foreground">{question.question}</span>
                    <span className="font-medium text-foreground">{words ?? 'Skipped'}</span>
                  </span>
                </button>
              </li>
            );
          }
          if (at > index) {
            return (
              <li key={at} className="flex items-start gap-2.5 px-1 text-[14px] leading-snug text-muted-foreground/70">
                <span
                  aria-hidden
                  className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px]"
                >
                  {at + 1}
                </span>
                {question.question}
              </li>
            );
          }
          const draft = drafts[at];
          return (
            <li
              key={at}
              ref={currentRef}
              tabIndex={-1}
              aria-label={count > 1 ? `Question ${at + 1} of ${count}` : 'Question'}
              className="rounded-2xl border border-border bg-card p-3 outline-none md:p-4"
            >
              <p className="flex items-start gap-2.5 text-[15px] font-semibold leading-snug text-foreground">
                <span
                  aria-hidden
                  className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-primary"
                >
                  {at + 1}
                </span>
                {question.question}
              </p>
              {question.why && (
                <p className="mt-1 pl-7.5 text-[13px] leading-snug text-muted-foreground">{question.why}</p>
              )}
              <div
                role="radiogroup"
                aria-label={question.question}
                onKeyDown={(event) => onOptionKey(event, question.options.length, chosenAt(draft))}
                className="mt-2.5 flex flex-col gap-1.5 md:pl-7.5"
              >
                {question.options.map((option, optionAt) => {
                  const chosen = draft !== null && 'option' in draft && draft.option === optionAt;
                  return (
                    <button
                      key={optionAt}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      // One stop for Tab: the chosen option, or the first when none is.
                      tabIndex={optionAt === (chosenAt(draft) ?? 0) ? 0 : -1}
                      data-option={optionAt}
                      disabled={locked}
                      onClick={() => choose(optionAt)}
                      className={cn(
                        'v2-interactive rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default',
                        chosen ? 'border-primary bg-accent/50' : 'border-border hover:bg-muted/60',
                        FOCUS_RING,
                      )}
                    >
                      <span className="text-[14px] font-medium text-foreground">
                        {option.label}
                        {question.recommended === optionAt && (
                          <span className="ml-2 text-xs font-normal text-primary">Recommended</span>
                        )}
                      </span>
                      {option.description && (
                        <span className="block text-[13px] leading-snug text-muted-foreground">{option.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={skipRest}
                  className={cn(
                    'v2-interactive rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
                    FOCUS_RING,
                  )}
                >
                  {count === 1 ? 'Skip' : isLast ? 'Skip and send' : 'Skip the rest'}
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={next}
                  className={cn(
                    'v2-interactive rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50',
                    FOCUS_RING,
                  )}
                >
                  {isLast ? (sending ? 'Sending…' : 'Send') : 'Next'}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {refused && (
        <p role="alert" className="mt-2 px-1 text-[13px] text-destructive">
          {refused}
        </p>
      )}
    </div>
  );
}
