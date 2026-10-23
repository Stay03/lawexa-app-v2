'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { QuizAttempt, QuizAttemptQuestion } from '@/types/channel-quiz';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { pointsLabel, questionVerdict, scenarioFor, secondsLabel, type QuestionVerdict } from '../model';
import { AttemptOptionTile } from '../player/AttemptOptionTile';
import { RaisedButton } from '../ui';
import {
  answersCounts,
  answersDeck,
  answersPositionLabel,
  indexAfterFilter,
  matchesAnswersFilter,
  openingAnswer,
  stepAnswer,
  type AnswersFilter,
} from './answers-model';

/**
 * AnswersStepper — "See your answers", ONE QUESTION PER PAGE (Stay, 23
 * October 2026, 00:03Z; Arthur, 00:16Z: "one per page is better"), modelled
 * on the practice review (`v2/features/quiz/results/ReviewStepper`):
 *
 *  - a grid of the question numbers, red for wrong, green for right, grey for
 *    a skipped one, the open one outlined; a tap jumps to it;
 *  - All, Wrong and Right, each with its count;
 *  - the question with only the tiles that matter (your wrong pick and the
 *    right answer, the play screen's own tiles) and the author's Why;
 *  - Back · "3 of 20" · Next along the bottom, and the ← → keys.
 *
 * The page stays one screen tall however long the quiz is.
 *
 * ── THE ADDRESS KEEPS THE PLACE, QUIETLY ───────────────────────────────────
 * `?q=` (1-based) mirrors the open question, so a reload lands on the same
 * one. The write is QUIET and REPLACES (`quietReplaceUrlParams`), for the
 * practice review's reasons: a loud write under a dynamic segment behind the
 * v2 rewrite makes Next's restore walk a broken param tree, and forty Next
 * presses must not bury the results under forty Back presses. Back leaves the
 * review. Component state is the reader; the address is read once
 * (`useSearchParams`, so the caller wraps this in `<Suspense>`).
 */
export function AnswersStepper({ attempt, questions }: { attempt: QuizAttempt; questions: readonly QuizAttemptQuestion[] }) {
  const searchParams = useSearchParams();
  const [opening] = useState(() => openingAnswer(questions, searchParams.get('q')));
  const [filter, setFilter] = useState<AnswersFilter>(opening.filter);
  const [current, setCurrent] = useState(opening.index);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const counts = useMemo(() => answersCounts(questions), [questions]);
  const deck = useMemo(() => answersDeck(questions, filter), [questions, filter]);
  const question = questions[current];

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    quietReplaceUrlParams({ q: String(index + 1) });
  }, []);

  const step = useCallback(
    (towards: 'next' | 'prev') => {
      const next = stepAnswer(deck, current, towards);
      if (next === null) return;
      setDirection(towards);
      goTo(next);
    },
    [current, deck, goTo],
  );

  const jumpTo = (index: number) => {
    setDirection(index >= current ? 'next' : 'prev');
    // The grid shows every question, so a jump can land outside the filter:
    // widening to All is the honest answer, the reader asked for that one.
    if (!matchesAnswersFilter(questions[index], filter)) setFilter('all');
    goTo(index);
  };

  const changeFilter = (next: AnswersFilter) => {
    setFilter(next);
    const index = indexAfterFilter(questions, current, next);
    if (index !== null && index !== current) goTo(index);
  };

  // ← → step the review. WCAG 2.1.4 covers character keys, not arrows, so a
  // document listener is allowed; it still yields to text entry and to
  // anything open on top. The listener only calls `step`.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const target = event.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      step(event.key === 'ArrowRight' ? 'next' : 'prev');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step]);

  const position = deck.indexOf(current);
  const atStart = position <= 0;
  const atEnd = position === -1 || position >= deck.length - 1;
  const filters: { key: AnswersFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'wrong', label: 'Wrong' },
    { key: 'right', label: 'Right' },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-bold text-foreground">See your answers</h1>
        <p className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
          {counts.right} of {counts.all} right
        </p>
      </div>

      <AnswerGrid questions={questions} current={current} onJump={jumpTo} />

      <div
        role="group"
        aria-label="Show"
        className="mt-3 inline-flex items-center gap-0.5 self-start rounded-full bg-secondary/60 p-0.5"
      >
        {filters.map((entry) => (
          <button
            key={entry.key}
            type="button"
            disabled={counts[entry.key] === 0}
            aria-pressed={filter === entry.key}
            onClick={() => changeFilter(entry.key)}
            className={cn(
              'v2-interactive min-h-8 rounded-full px-3.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40',
              filter === entry.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              FOCUS_RING,
            )}
          >
            {entry.label} <span className="tabular-nums opacity-60">{counts[entry.key]}</span>
          </button>
        ))}
      </div>

      {question ? (
        <div
          key={current}
          className={cn(
            'mt-5 border-t border-border/60 pt-4 motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both motion-safe:duration-200',
            direction === 'next' ? 'motion-safe:slide-in-from-right-4' : 'motion-safe:slide-in-from-left-4',
          )}
        >
          <AnswerPage attempt={attempt} question={question} index={current} />
        </div>
      ) : null}

      {/* Along the bottom, over the page's see-through plate (the results'
          own bar): Back, where the reader is, Next; at the end, Done. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto flex items-center gap-3 bg-background/85 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/70">
        <button
          type="button"
          onClick={() => step('prev')}
          disabled={atStart}
          className={cn(
            'v2-interactive inline-flex h-12 items-center gap-1 rounded-full border-2 border-border px-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-40',
            FOCUS_RING,
          )}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </button>
        <span role="status" aria-live="polite" className="flex-1 text-center text-sm text-muted-foreground tabular-nums">
          {answersPositionLabel(deck, current, filter)}
        </span>
        {atEnd ? (
          <RaisedButton asChild className="h-12 px-5">
            <Link href={`/quiz/attempts/${attempt.uuid}/results`}>Done</Link>
          </RaisedButton>
        ) : (
          <RaisedButton className="h-12 px-5" onClick={() => step('next')}>
            Next
            <ChevronRight aria-hidden className="size-4" />
          </RaisedButton>
        )}
      </div>
    </div>
  );
}

/* ── The number grid ──────────────────────────────────────────────────────── */

const CELL_TONE: Record<QuestionVerdict, string> = {
  correct: 'bg-[var(--solo-right-ink)] text-[var(--solo-right)]',
  incorrect: 'bg-[var(--solo-wrong-ink)] text-[var(--solo-wrong)]',
  unanswered: 'bg-secondary text-muted-foreground',
};

const VERDICT_WORD: Record<QuestionVerdict, string> = {
  correct: 'right',
  incorrect: 'wrong',
  unanswered: 'not answered',
};

/** One cell per question, ten to a row; the open one has an OUTLINE (a shape
 *  difference, never a third colour), and every cell names its verdict. */
function AnswerGrid({
  questions,
  current,
  onJump,
}: {
  questions: readonly QuizAttemptQuestion[];
  current: number;
  onJump: (index: number) => void;
}) {
  return (
    <ol aria-label="Questions" className="mt-4 grid grid-cols-10 gap-1.5">
      {questions.map((question, index) => {
        const verdict = questionVerdict(question);
        const open = index === current;
        return (
          <li key={question.uuid}>
            <button
              type="button"
              onClick={() => onJump(index)}
              aria-current={open ? 'step' : undefined}
              aria-label={`Question ${index + 1}, ${VERDICT_WORD[verdict]}`}
              className={cn(
                'v2-interactive grid h-8 w-full place-items-center rounded-lg text-xs font-semibold tabular-nums transition-colors',
                CELL_TONE[verdict],
                open && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
                FOCUS_RING,
              )}
            >
              {index + 1}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ── One question ─────────────────────────────────────────────────────────── */

/** The question, the tiles that matter, and the Why. */
function AnswerPage({ attempt, question, index }: { attempt: QuizAttempt; question: QuizAttemptQuestion; index: number }) {
  const verdict = questionVerdict(question);
  const scenario = scenarioFor(attempt, question);
  const right = question.options.find((option) => option.id === question.correct_option_id) ?? null;
  const picked =
    verdict === 'incorrect' ? (question.options.find((option) => option.id === question.your_option_id) ?? null) : null;
  const points = question.points ?? 0;
  const explanation = question.explanation?.trim() || null;
  const responseMs = question.response_ms ?? null;

  return (
    <section aria-label={`Question ${index + 1}`}>
      <div className="flex items-center justify-between gap-3 text-[13px] font-semibold text-muted-foreground">
        <span className="tabular-nums">
          Question {index + 1}
          {verdict !== 'unanswered' && responseMs !== null ? ` · ${secondsLabel(responseMs)}` : ''}
        </span>
        <span
          className={cn(
            'font-comfortaa text-base font-bold tabular-nums',
            points > 0 ? 'text-[var(--solo-right)]' : 'text-muted-foreground',
          )}
        >
          +{pointsLabel(points)}
        </span>
      </div>

      {scenario ? (
        <div className="mt-3 rounded-xl bg-secondary/50 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
          {scenario.title ? <p className="font-semibold text-foreground">{scenario.title}</p> : null}
          <p className="whitespace-pre-line">{scenario.passage}</p>
        </div>
      ) : null}

      <h2 className="mt-2 text-lg leading-snug font-bold text-foreground">{question.question}</h2>

      <div className="mt-4 flex flex-col gap-2.5">
        {picked ? <AttemptOptionTile index={0} content={picked.content} look="card" state="wrong-pick" /> : null}
        {right ? <AttemptOptionTile index={1} content={right.content} look="card" state="correct" /> : null}
      </div>
      {verdict === 'unanswered' ? (
        <p className="mt-2 text-[13px] text-muted-foreground">You didn&rsquo;t answer this one in time.</p>
      ) : null}

      {/* Why the right answer is right, in the author's words (Arthur, 22
          October 2026); nothing when the author wrote none. */}
      {explanation ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold tracking-[0.08em] text-primary uppercase">Why</p>
          <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line text-foreground/85">{explanation}</p>
        </div>
      ) : null}
    </section>
  );
}
