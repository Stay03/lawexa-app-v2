'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuizResultsAnswerSheet } from './QuizResultsAnswerSheet';
import { QuizResultItemCard } from './QuizResultItemCard';
import type { QuizResultItem } from '@/types/quiz';

interface QuizResultsReviewProps {
  questions: QuizResultItem[];
}

type ReviewFilter = 'all' | 'incorrect' | 'correct';

/** Large sessions open straight into the questions you actually need to review. */
const INCORRECT_FIRST_THRESHOLD = 20;

/**
 * Stepper review: one question at a time, navigated by Prev/Next, the ← → keys,
 * or the answer-sheet grid. A filter narrows the deck to all / incorrect /
 * correct. This keeps the page a constant length whether the session has 6 or
 * 200 questions — there is no long list to scroll.
 */
export function QuizResultsReview({ questions }: QuizResultsReviewProps) {
  const total = questions.length;
  const incorrectCount = useMemo(
    () => questions.filter((q) => !q.was_correct).length,
    [questions]
  );
  const correctCount = total - incorrectCount;

  const initialFilter: ReviewFilter =
    total > INCORRECT_FIRST_THRESHOLD && incorrectCount > 0 ? 'incorrect' : 'all';

  const [filter, setFilter] = useState<ReviewFilter>(initialFilter);
  const [currentIndex, setCurrentIndex] = useState(() =>
    initialFilter === 'incorrect'
      ? questions.findIndex((q) => !q.was_correct)
      : 0
  );
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const matchesFilter = useCallback(
    (item: QuizResultItem, f: ReviewFilter) =>
      f === 'all' ? true : f === 'incorrect' ? !item.was_correct : item.was_correct,
    []
  );

  // Absolute indices of the questions visible under the current filter.
  const deck = useMemo(
    () =>
      questions.reduce<number[]>((acc, item, index) => {
        if (matchesFilter(item, filter)) acc.push(index);
        return acc;
      }, []),
    [questions, filter, matchesFilter]
  );

  const positionInDeck = deck.indexOf(currentIndex);
  const atStart = positionInDeck <= 0;
  const atEnd = positionInDeck >= deck.length - 1;
  const current = questions[currentIndex];

  const go = useCallback(
    (dir: 'next' | 'prev') => {
      setDirection(dir);
      setCurrentIndex((prev) => {
        const pos = deck.indexOf(prev);
        const nextPos = dir === 'next' ? pos + 1 : pos - 1;
        if (nextPos < 0 || nextPos >= deck.length) return prev;
        return deck[nextPos];
      });
    },
    [deck]
  );

  const changeFilter = useCallback(
    (next: ReviewFilter) => {
      setFilter(next);
      setCurrentIndex((prev) => {
        if (matchesFilter(questions[prev], next)) return prev;
        const first = questions.findIndex((q) => matchesFilter(q, next));
        return first === -1 ? prev : first;
      });
    },
    [questions, matchesFilter]
  );

  const jumpTo = useCallback(
    (index: number) => {
      setDirection(index >= currentIndex ? 'next' : 'prev');
      if (!matchesFilter(questions[index], filter)) setFilter('all');
      setCurrentIndex(index);
    },
    [currentIndex, filter, matchesFilter, questions]
  );

  // Arrow-key navigation. The listener calls the handlers; nothing runs during
  // the effect body itself.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'ArrowRight') go('next');
      else if (e.key === 'ArrowLeft') go('prev');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go]);

  const filters: { key: ReviewFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'incorrect', label: 'Incorrect', count: incorrectCount },
    { key: 'correct', label: 'Correct', count: correctCount },
  ];

  return (
    <div className="space-y-4">
      <QuizResultsAnswerSheet
        questions={questions}
        currentIndex={currentIndex}
        onJump={jumpTo}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Review
        </h2>
        <div className="inline-flex items-center gap-1 rounded-full bg-muted/50 p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              disabled={f.count === 0}
              onClick={() => changeFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
                filter === f.key
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label} <span className="tabular-nums opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => go('prev')}
          disabled={atStart}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {deck.length ? positionInDeck + 1 : 0} of {deck.length}
          {filter !== 'all' ? ` ${filter}` : ''}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => go('next')}
          disabled={atEnd}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {current ? (
        <div
          key={currentIndex}
          className={cn(
            'animate-in fade-in-0 fill-mode-both duration-200 motion-reduce:animate-none',
            direction === 'next'
              ? 'slide-in-from-right-6'
              : 'slide-in-from-left-6'
          )}
        >
          <QuizResultItemCard item={current} index={currentIndex} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card/50 py-10 text-center text-sm text-muted-foreground">
          No questions in this filter.
        </div>
      )}
    </div>
  );
}
