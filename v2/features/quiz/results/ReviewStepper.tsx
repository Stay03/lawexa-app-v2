'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { QuizResultItem } from '@/types/quiz';
import { quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { AnswerSheet } from './AnswerSheet';
import { ResultItemCard } from './ResultItemCard';

/**
 * ReviewStepper — the review itself: ONE question at a time, navigated by the
 * Prev/Next buttons, the ← → keys, or the answer-sheet grid above it.
 *
 * ── WHY A STEPPER AND NOT A LIST ────────────────────────────────────────────
 * Sessions are endless — six questions or two hundred — so a list would make
 * the page's length a function of how much the reader practised, which is
 * exactly backwards. The stepper keeps the page one screen tall at any size and
 * hands the "where am I" job to the answer sheet, which is built for it.
 *
 * ── THE URL REMEMBERS THE PLACE, QUIETLY ────────────────────────────────────
 * `?q=` mirrors the open question (1-based, because it is a human-facing
 * number), so a reload or a shared link lands back on the same card instead of
 * question one.
 *
 * The write is QUIET (`quietReplaceUrlParams`) and that is load-bearing, not a
 * preference. This screen lives under the dynamic `[sessionUuid]` segment
 * served through the v2 rewrite proxy — the exact geometry where a LOUD history
 * write makes Next 16's restore machinery walk a broken param tree and refetch
 * `/quiz/undefined` in waves, forever (the autopsy is in `url-params.ts`).
 * Quiet writes are invisible to `useSearchParams`, which is why COMPONENT STATE
 * is the reader here: the URL is initialised from once and mirrored on every
 * move thereafter.
 *
 * REPLACE, NOT PUSH — so the whole review is ONE history entry. Stepping
 * through forty questions must not bury the page the reader arrived from under
 * forty Back presses; Back leaves the results, which is what a reader means by
 * it. The consequence is that Back/Forward never move the stepper, so there is
 * deliberately no `popstate` listener: with replace-only writes it could never
 * fire for a change this component made, and a handler that cannot run is just
 * a claim the code does not honour.
 *
 * Nothing is written on mount either — only on a real move — so arriving at the
 * review never rewrites the URL it arrived with.
 *
 * THE FIRST READ USES `useSearchParams()`, NOT `window.location`. A lazy
 * initialiser reading `window.location.search` is unavailable wherever `window`
 * is not — so it would have to fall back to a different answer than the one the
 * URL actually carries, which is a wrong opening question on exactly the links
 * people share. `useSearchParams()` is the router's own answer and needs no
 * fallback (the `RadarsBrowser` precedent); it is also why the caller wraps
 * this component in the `<Suspense>` boundary Next requires for that hook.
 *
 * ── ARROW KEYS ARE DOCUMENT-LEVEL, AND THAT IS ALLOWED ──────────────────────
 * WCAG 2.1.4 governs CHARACTER keys; arrow keys are explicitly not among them,
 * so a document listener needs no focus scope (unlike the player's 1–4 keys,
 * which are scoped to the question group for exactly that reason). It still
 * yields to text controls, so typing anywhere on the page can never step the
 * review.
 */

type ReviewFilter = 'all' | 'incorrect' | 'correct';

/** Past this many answers, a review that opens on question one wastes the
 *  reader's time — so it opens on the first thing they got wrong instead. */
const INCORRECT_FIRST_THRESHOLD = 20;

const TEXT_ENTRY = /^(INPUT|TEXTAREA|SELECT)$/;

function matchesFilter(item: QuizResultItem, filter: ReviewFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'incorrect' ? !item.was_correct : item.was_correct;
}

/**
 * Parse a `?q=` value (1-based, human-facing) into a 0-based index, or null
 * when it is absent, malformed, or outside this session's range.
 */
function parseIndex(raw: string | null, total: number): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > total) return null;
  return parsed - 1;
}

export function ReviewStepper({ questions }: { questions: QuizResultItem[] }) {
  const total = questions.length;
  const searchParams = useSearchParams();

  const incorrectCount = useMemo(
    () => questions.filter((item) => !item.was_correct).length,
    [questions],
  );
  const correctCount = total - incorrectCount;

  // The router's own answer, so it needs no environment fallback — see the
  // docblock. Both initialisers below read it.
  const indexFromUrl = parseIndex(searchParams.get('q'), total);
  const openOnIncorrect = total > INCORRECT_FIRST_THRESHOLD && incorrectCount > 0;

  // Both initialisers run ONCE, lazily.
  const [filter, setFilter] = useState<ReviewFilter>(() => {
    // A shared link names a specific question, so it wins over the heuristic —
    // otherwise the target could sit outside the opening filter's deck.
    if (indexFromUrl !== null) return 'all';
    return openOnIncorrect ? 'incorrect' : 'all';
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (indexFromUrl !== null) return indexFromUrl;
    if (openOnIncorrect) {
      const firstWrong = questions.findIndex((item) => !item.was_correct);
      return firstWrong === -1 ? 0 : firstWrong;
    }
    return 0;
  });

  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  /** Absolute indices visible under the current filter. */
  const deck = useMemo(
    () =>
      questions.reduce<number[]>((acc, item, index) => {
        if (matchesFilter(item, filter)) acc.push(index);
        return acc;
      }, []),
    [questions, filter],
  );

  const positionInDeck = deck.indexOf(currentIndex);
  const atStart = positionInDeck <= 0;
  const atEnd = positionInDeck >= deck.length - 1;
  const current = questions[currentIndex];

  /** Move the pointer AND mirror it into the URL. One place, so the two can
   *  never disagree. */
  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    quietReplaceUrlParams({ q: String(index + 1) });
  }, []);

  const step = useCallback(
    (towards: 'next' | 'prev') => {
      const position = deck.indexOf(currentIndex);
      const nextPosition = towards === 'next' ? position + 1 : position - 1;
      if (nextPosition < 0 || nextPosition >= deck.length) return;
      setDirection(towards);
      goTo(deck[nextPosition]);
    },
    [currentIndex, deck, goTo],
  );

  const changeFilter = useCallback(
    (next: ReviewFilter) => {
      setFilter(next);
      // Stay on the current question when it survives the new filter; otherwise
      // land on the first one that does, so the deck is never empty-looking.
      if (matchesFilter(questions[currentIndex], next)) return;
      const first = questions.findIndex((item) => matchesFilter(item, next));
      if (first !== -1) goTo(first);
    },
    [currentIndex, goTo, questions],
  );

  const jumpTo = useCallback(
    (index: number) => {
      setDirection(index >= currentIndex ? 'next' : 'prev');
      // The answer sheet shows EVERY question, so a jump can land outside the
      // active filter. Widening to "all" is the honest resolution — the reader
      // asked for that specific question.
      if (!matchesFilter(questions[index], filter)) setFilter('all');
      goTo(index);
    },
    [currentIndex, filter, goTo, questions],
  );

  // ← → navigation. The listener only CALLS handlers; nothing runs in the
  // effect body itself, so the React Compiler lint's no-setState-in-effect rule
  // is satisfied.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target) {
        if (event.key === 'ArrowRight') step('next');
        else if (event.key === 'ArrowLeft') step('prev');
        return;
      }
      // Text entry owns its own caret movement.
      if (TEXT_ENTRY.test(target.tagName) || target.isContentEditable) return;
      // So does anything inside an overlay. A document-level listener outlives
      // whatever opens on top of this screen, and a stepper quietly advancing
      // behind a dialog the reader is arrowing through is the classic
      // global-listener bug. Nothing on the review opens one today — this is
      // the guard that keeps it true when something does.
      if (target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) {
        return;
      }
      if (event.key === 'ArrowRight') step('next');
      else if (event.key === 'ArrowLeft') step('prev');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step]);

  const filters: { key: ReviewFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'incorrect', label: 'Incorrect', count: incorrectCount },
    { key: 'correct', label: 'Correct', count: correctCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AnswerSheet
        questions={questions}
        currentIndex={currentIndex}
        onJump={jumpTo}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-medium text-muted-foreground">Review</h2>
        <div
          role="group"
          aria-label="Filter the review"
          className="inline-flex items-center gap-1 rounded-full bg-secondary/60 p-1"
        >
          {filters.map((entry) => (
            <button
              key={entry.key}
              type="button"
              disabled={entry.count === 0}
              onClick={() => changeFilter(entry.key)}
              aria-pressed={filter === entry.key}
              className={cn(
                'v2-interactive rounded-full px-3 py-1 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
                filter === entry.key
                  ? 'bg-card text-foreground ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {entry.label}{' '}
              <span className="tabular-nums opacity-60">{entry.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => step('prev')}
          disabled={atStart}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </Button>
        {/* The one live region on this surface: stepping is silent otherwise,
            because the card that changes is not focused. */}
        <span
          role="status"
          aria-live="polite"
          className="text-sm tabular-nums text-muted-foreground"
        >
          {deck.length ? positionInDeck + 1 : 0} of {deck.length}
          {filter === 'all' ? '' : ` ${filter}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => step('next')}
          disabled={atEnd}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>

      {current ? (
        <div
          key={currentIndex}
          className={cn(
            'motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both motion-safe:duration-200',
            direction === 'next'
              ? 'motion-safe:slide-in-from-right-4'
              : 'motion-safe:slide-in-from-left-4',
          )}
        >
          <ResultItemCard item={current} index={currentIndex} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-card/50 py-10 text-center text-sm text-muted-foreground">
          Nothing matches this filter.
        </p>
      )}
    </div>
  );
}
