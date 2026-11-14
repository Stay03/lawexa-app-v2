'use client';

import { useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref, type RefObject } from 'react';
import { PenLine, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  answersToSend,
  boxAnsweringFor,
  chosenAt,
  optionKeyTarget,
  skipAllAnswers,
  startingAnswer,
  type BoxAnswering,
} from '@/lib/utils/question-card';
import type { MessageAttachment, QuestionCardAnswer } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules/meta';
import type { ConversationComposerHandle } from '../ConversationComposer';
import type { SendRefused } from '../space-turn';
import type { OpenCard } from './open-card';

/** The message box's hint while Lawexa's questions wait: a typed reply goes instead of the answers. */
export const CARD_ANSWER_PLACEHOLDER = 'Or type a different answer';

/** The longest own answer the server takes for one question (Backend's 13566521). */
export const OTHER_ANSWER_MAX = 2000;

/** The box's line when files ride with an answer to a question. */
export const ANSWER_FILES_COPY = 'An answer to a question goes without files. Remove them, or send them after the questions.';

/** The box's line when an answer is longer than the server takes. */
export const ANSWER_TOO_LONG_COPY = `An answer can be up to ${OTHER_ANSWER_MAX.toLocaleString('en')} characters.`;

/** What the host's box sends to the card while it is the field for "Something else". */
export interface QuestionDockHandle {
  /**
   * The box's send, while it answers a question: the words are that question's
   * answer. The card moves to the next question, or on the last sends every
   * answer. A refusal gives the words back to the box.
   */
  answer: (text: string, attachments: MessageAttachment[]) => Promise<SendRefused | undefined>;
}

type QuestionDockProps = {
  open: OpenCard;
  /** Nothing can be sent yet (the chat loads, a turn runs, another member's turn holds it). */
  held: boolean;
  /** Send the answers; resolves with the refusal's sentence, or null when they went. */
  onAnswer: (answers: QuestionCardAnswer[]) => Promise<string | null>;
  /** The message box under the card: it is the field for "Something else". */
  box: RefObject<ConversationComposerHandle | null>;
  /** The box answers a question (its hint and its arrow's name), or null: it is a reply box again. */
  onBoxAnswering: (answering: BoxAnswering | null) => void;
  ref?: Ref<QuestionDockHandle>;
};

/**
 * QuestionDock — Lawexa's questions on a card docked on the message box
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
 * The card sits flush on the box, so the two read as one (V3: Stay, 14
 * November 2026, "5v3"). "Something else" makes the box the field: the
 * reader types where they always type, and the options stay in view. While it
 * is on, the card's Next and Skip step away and the box's arrow is the one way
 * on: it records the words and moves to the next question, or sends on the
 * last (its name says "Next" or "Send"). Choosing an option, or "Something
 * else" again, gives the box back as a reply box. The words are kept for the
 * question, and the reader's own draft waits aside while the box answers.
 *
 * On a phone the card is capped at 60% of the screen and scrolls inside, and
 * it sits on the box, which the app keeps above the keyboard.
 *
 * Keyed by the card by its host, so a new card starts fresh.
 */
export function QuestionDock({ open, held, onAnswer, box, onBoxAnswering, ref }: QuestionDockProps) {
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
  // The reader's own draft from the box, set aside while the box answers a question; null when it does not.
  const replyDraft = useRef<string | null>(null);

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

  /**
   * Make the box the field for question `at`, or a reply box again (null).
   * Gives back the words the box held when it was answering, or null.
   */
  const pointBox = (at: number | null, words: readonly string[] = ownWords, focus = true): string | null => {
    const answering = replyDraft.current !== null;
    if (!answering && at === null) return null;
    const previous = box.current?.swap(at === null ? (replyDraft.current ?? '') : words[at]) ?? '';
    if (!answering) replyDraft.current = previous;
    if (at === null) replyDraft.current = null;
    onBoxAnswering(at === null ? null : boxAnsweringFor(at, count));
    // Inside the tap, so a phone raises its keyboard.
    if (at !== null && focus) box.current?.focus();
    return answering ? previous : null;
  };

  /** Keep the words the box held as question `at`'s own answer. */
  const keepWords = (at: number, words: string, chosen: boolean) => {
    setOwnWords((current) => current.map((entry, place) => (place === at ? words : entry)));
    if (chosen) setDrafts((current) => current.map((entry, place) => (place === at ? { text: words } : entry)));
  };

  const send = async (answers: QuestionCardAnswer[]) => {
    setSending(true);
    setRefused(null);
    const sentence = await onAnswer(answers);
    // Sent: the card closes with the chat's next render. Refused: it stays, choices kept, with the reason.
    setSending(false);
    setRefused(sentence);
    return sentence;
  };

  const goTo = (at: number, current: readonly (QuestionCardAnswer | null)[] = drafts) => {
    const target = current[at] ?? null;
    const left = pointBox(target !== null && 'text' in target ? at : null);
    if (left !== null) keepWords(index, left, true);
    setIndex(at);
    setReached((furthest) => Math.max(furthest, at));
  };

  const next = (current: (QuestionCardAnswer | null)[] = drafts) => {
    if (locked) return;
    if (isLast) void send(answersToSend(questions, current));
    else goTo(index + 1, current);
  };

  const skip = () => {
    if (locked) return;
    const current = drafts.map((entry, at) => (at === index ? null : entry));
    setDrafts(current);
    next(current);
  };

  const skipAll = async () => {
    if (locked) return;
    const left = pointBox(null);
    if (left !== null) keepWords(index, left, true);
    const sentence = await send(skipAllAnswers(questions));
    // Refused while the box was answering: it answers again, with the words.
    if (sentence !== null && left !== null) pointBox(index, ownWords.map((entry, at) => (at === index ? left : entry)));
  };

  /** `byKey`: the arrow keys moved the choice, so the keyboard stays on the choices. */
  const choose = (choice: number, byKey = false) => {
    if (locked) return;
    if (choice === optionCount) {
      if (ownChosen) {
        // "Something else" again: the box is a reply box, the words wait for the question.
        const left = pointBox(null);
        if (left !== null) keepWords(index, left, false);
        setDraft(null);
        return;
      }
      setDraft({ text: ownWords[index] });
      pointBox(index, ownWords, !byKey);
      return;
    }
    const left = pointBox(null);
    if (left !== null) keepWords(index, left, false);
    setDraft({ option: choice });
  };

  useImperativeHandle(ref, () => ({
    answer: async (text, attachments) => {
      // The words come back to the box with the reason; the card says nothing new.
      if (locked) return { refused: '' };
      if (attachments.length > 0) return { refused: ANSWER_FILES_COPY };
      if (text.length > OTHER_ANSWER_MAX) return { refused: ANSWER_TOO_LONG_COPY };
      const words = ownWords.map((entry, at) => (at === index ? text : entry));
      const current = drafts.map((entry, at) => (at === index ? { text } : entry));
      setOwnWords(words);
      setDrafts(current);
      if (!isLast) {
        const target = current[index + 1] ?? null;
        pointBox(target !== null && 'text' in target ? index + 1 : null, words);
        setIndex(index + 1);
        setReached((furthest) => Math.max(furthest, index + 1));
        return undefined;
      }
      const sentence = await send(answersToSend(questions, current));
      // Refused: the words go back in the box, and the card says why.
      if (sentence !== null) return { refused: '' };
      // Sent: the card closes, and the reader's own draft comes back to the box.
      pointBox(null);
      return undefined;
    },
  }));

  // The choices as a radio group for the keyboard: Tab reaches the chosen one,
  // the arrow keys (and Home, End) move the choice. Nothing is sent; Next does.
  const onChoiceKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked || !(event.target instanceof HTMLButtonElement)) return;
    const target = optionKeyTarget(event.key, choiceAt, optionCount + 1);
    if (target === null) return;
    event.preventDefault();
    // Home or End on the choice already made changes nothing ("Something else" would turn off).
    if (target === choiceAt) return;
    choose(target, true);
    if (target < optionCount) event.currentTarget.querySelector<HTMLButtonElement>(`[data-option="${target}"]`)?.focus();
  };

  return (
    <section
      aria-label="Lawexa's questions"
      // Flush on the box: no gap, and no corners or border where the two meet.
      className="mx-4 flex max-h-[60dvh] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-border bg-card"
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
          onClick={() => void skipAll()}
          className={cn('v2-interactive -mr-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40', FOCUS_RING)}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className={cn('min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-2', ownChosen && 'pb-3')}>
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
          <button
            type="button"
            role="radio"
            aria-checked={ownChosen}
            tabIndex={choiceAt === optionCount ? 0 : -1}
            data-option={optionCount}
            disabled={locked}
            onClick={() => choose(optionCount)}
            className={cn(
              'v2-interactive flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14.5px] transition-colors disabled:cursor-default',
              ownChosen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <PenLine aria-hidden className={cn('size-[18px] shrink-0', ownChosen && 'text-primary')} />
            <span className={cn(ownChosen && 'font-medium')}>Something else</span>
            {ownChosen && <span className="text-muted-foreground">· type it below</span>}
          </button>
        </div>
        {refused && (
          <p role="alert" className="mt-2 px-1 text-[13px] text-destructive">
            {refused}
          </p>
        )}
      </div>

      {/* While the box takes the answer, its arrow is the one way on. */}
      {!ownChosen && (
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
      )}
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
