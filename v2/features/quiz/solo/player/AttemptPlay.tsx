'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Flag, Loader2, Timer, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { QuizAttempt } from '@/types/channel-quiz';
import { SPEED_SCORING_NOTE } from '@/v2/features/channels/quiz/model';
import { OptionTile, PhaseRow } from '@/v2/features/channels/quiz/ui';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { QuizMessage } from '../../ui/QuizMessage';
import { PLAYER_COLUMN } from '../../player/states';
import {
  answerRefusalCopy,
  attemptPoints,
  attemptResultsHref,
  END_MODE_ADVANCE_MS,
  optionTileState,
  orderedQuestions,
  nextUnanswered,
  playStep,
  pointsLabel,
  questionDeadlineMs,
  responseMsFor,
  unansweredCount,
} from '../model';
import { useAnswerAttempt, useFinishAttempt } from '../mutations';
import { AttemptTimer } from './AttemptTimer';

/**
 * AttemptPlay — the play loop of one attempt, from the question it resumes on
 * to Finish.
 *
 * ── THE SERVER HOLDS THE ANSWERS, THE SCREEN HOLDS THE PLACE ───────────────
 * Which questions are answered, with what, and (on an `each` attempt) whether
 * they were right all live on the cached attempt, written there from each
 * receipt (`useAnswerAttempt`) and re-read on resume. This component holds
 * only the CURSOR — which question is on screen — and the moment it opened,
 * set together in the handler that moves on, so a question can never be shown
 * with the previous one's clock. The step the question is at (`playStep`) is
 * derived from the server's state of it plus a send in flight and the clock
 * having run out; nothing here decides an answer was right.
 *
 * ── THE CLOCK IS THE APP'S, AND IT IS HONEST ABOUT IT ──────────────────────
 * There is no `opens_at` on the wire. The moment a question opens is read
 * ONCE, in the handler (wall clock for the bar, `performance.now()` for the
 * measurement), never in render. `response_ms` is the monotonic difference at
 * the tap; the server clamps it to the limit. At zero the grid locks on a
 * timeout and the question is skipped — nothing is recorded, and the results
 * score it as wrong — because a timer that ended nothing would be decoration.
 * A reload mid-question restarts that question's clock: the server has no
 * stamp to restore it from (named in the report).
 *
 * ── AFTER EACH QUESTION, OR AT THE END ─────────────────────────────────────
 * On an `each` attempt the receipt is the reveal: the tiles turn (the channel
 * game's own `OptionTile` states), the verdict and the points land under
 * them, and the reader moves on when ready. On an `end` attempt the receipt
 * carries counts only, so the locked tile is held a beat and the next
 * question arrives on its own; the verdicts wait for the results.
 *
 * ── A 409 IS NOT A FAILURE ─────────────────────────────────────────────────
 * The server already has this answer (a second tab), or has already scored
 * the attempt. The mutation re-reads the attempt; the question then shows its
 * verdict, or the screen above sends the reader to the results. No sentence
 * is printed for it (`answerRefusalCopy`). Everything else is said under the
 * grid, in place: this surface has no toasts.
 *
 * ── KEYS 1–4, SCOPED TO FOCUS (WCAG 2.1.4) ─────────────────────────────────
 * The digit shortcuts are bound to the question GROUP, not the window, so
 * they are live exactly while focus is inside it (the practice player's
 * rule). Focus moves to the group on every question CHANGE, never on first
 * mount, with the house ring on `:focus-visible` so a keyboard player can see
 * where they are.
 */

interface PlayPlace {
  /** Index into the play-ordered questions; `questions.length` once every
   *  question has an answer and only Finish is left. */
  cursor: number;
  /** Wall clock at open, for the bar. */
  openedAtMs: number;
  /** Monotonic clock at open, for `response_ms`. */
  openedPerfMs: number;
  /** The app's clock ran out on this question before an answer was sent. */
  timedOut: boolean;
}

export function AttemptPlay({
  attempt,
  viewerId,
}: {
  attempt: QuizAttempt;
  viewerId: number | null;
}) {
  const router = useRouter();
  const questions = useMemo(() => orderedQuestions(attempt), [attempt]);
  const total = attempt.question_count;

  // Opens on the first unanswered question (the resume), with the clock read
  // once, lazily — never in render.
  const [place, setPlace] = useState<PlayPlace>(() => ({
    cursor: nextUnanswered(attempt) ?? questions.length,
    openedAtMs: Date.now(),
    openedPerfMs: performance.now(),
    timedOut: false,
  }));
  /** The tapped option, keyed to its cursor so a stale tap is never current. */
  const [pending, setPending] = useState<{ cursor: number; optionId: number } | null>(null);
  /** The one sentence under the grid for a refusal, cleared on every move. */
  const [note, setNote] = useState<string | null>(null);

  const answer = useAnswerAttempt(attempt.uuid, viewerId);
  const finish = useFinishAttempt(attempt.uuid, viewerId);

  const { cursor } = place;
  const question = questions[cursor];
  const isLast = cursor >= questions.length - 1;
  const pendingPick = pending?.cursor === cursor ? pending.optionId : null;
  const sending = answer.isPending && pendingPick !== null;
  const step = question ? playStep(question, attempt.reveal_mode, sending, place.timedOut) : null;
  const points = attemptPoints(attempt);
  const unanswered = unansweredCount(attempt);

  const advance = useCallback(() => {
    setNote(null);
    setPlace({
      cursor: cursor + 1,
      openedAtMs: Date.now(),
      openedPerfMs: performance.now(),
      timedOut: false,
    });
  }, [cursor]);

  // TIME'S UP, on a timeout armed when the question opens. Armed only while
  // the question is `open`: a send in flight keeps its chance (the server
  // decides), and a send that fails after zero re-arms with nothing left and
  // locks at once. The cursor is compared inside so a timeout that outlives
  // its question can never lock the next one.
  useEffect(() => {
    if (!question || step !== 'open') return;
    const remaining = questionDeadlineMs(place.openedAtMs, question.time_limit_seconds) - Date.now();
    const id = window.setTimeout(() => {
      setPlace((current) =>
        current.cursor === cursor ? { ...current, timedOut: true } : current,
      );
    }, Math.max(0, remaining));
    return () => window.clearTimeout(id);
  }, [question, step, place.openedAtMs, cursor]);

  // An `end` attempt moves on by itself once the pick is in — except on the
  // last question, where Finish is the reader's to press.
  useEffect(() => {
    if (step !== 'answered' || isLast) return;
    const id = window.setTimeout(advance, END_MODE_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [step, isLast, advance]);

  const pick = (optionId: number) => {
    if (!question || step !== 'open') return;
    setNote(null);
    setPending({ cursor, optionId });
    answer.mutate(
      {
        question_uuid: question.uuid,
        option_id: optionId,
        response_ms: responseMsFor(place.openedPerfMs, performance.now()),
      },
      {
        onSuccess: () => setPending(null),
        onError: (error) => {
          setPending(null);
          const { status, message } = extractApiError(error);
          setNote(answerRefusalCopy(status, message));
        },
      },
    );
  };

  const finishNow = () => {
    setNote(null);
    finish.mutate(undefined, {
      onSuccess: () => router.replace(attemptResultsHref(attempt.uuid)),
      onError: (error) => {
        const { status, message } = extractApiError(error);
        // Already scored elsewhere: the re-read carries the score and the
        // screen above sends the reader to it.
        if (status === 409) return;
        setNote(message);
      },
    });
  };

  const finishing = finish.isPending;
  /** The sentence the one live region says after an answer in THIS mount. */
  const receipt = answer.isSuccess ? answer.data.data : null;
  const announcement = receipt
    ? receipt.is_correct === undefined
      ? `Answer recorded. ${receipt.answered_count} of ${receipt.question_count} answered.`
      : `Answer recorded. ${receipt.is_correct ? 'Correct' : 'Not this time'}. ${pointsLabel(points)} points so far.`
    : '';

  return (
    <div className={PLAYER_COLUMN}>
      {/* The quiz's name stays on the page, over the question: the bar
          carries no title for this address (`pushed-route.ts`). */}
      <p className="truncate pt-4 text-sm text-muted-foreground">{attempt.quiz.title}</p>

      {/* STICKY, NOT FIXED — pins inside the shell's one scroll container,
          the practice player's bar. */}
      <div className="sticky top-0 z-10 -mx-4 mt-2 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/70">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {question ? `Question ${cursor + 1} of ${total}` : `${total} of ${total} answered`}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs tabular-nums">
          {/* Mounted from the first frame, EMPTY until an answer is recorded in
              this mount — a live region only reliably announces changes it is
              present for (the practice `ScoreChip` rule). */}
          <span role="status" aria-live="polite" className="sr-only">
            {announcement}
          </span>
          {attempt.reveal_mode === 'each' ? (
            <span aria-hidden className="flex items-center gap-1">
              <span className="font-semibold text-foreground">{pointsLabel(points)}</span>
              <span className="text-muted-foreground">pts</span>
            </span>
          ) : (
            <span aria-hidden className="text-muted-foreground">
              {attempt.answered_count}/{total} answered
            </span>
          )}
        </span>
      </div>

      {question && step ? (
        <div className="flex flex-col gap-5 pt-6">
          {/* The one fixed-height row over the question: the draining bar
              while it is open, and the word for what happened after. */}
          {step === 'open' || step === 'sending' ? (
            <AttemptTimer
              key={cursor}
              openedAtMs={place.openedAtMs}
              limitSeconds={question.time_limit_seconds}
            />
          ) : (
            <PhaseRow>
              {step === 'timed-out' ? (
                <Timer aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Check
                  aria-hidden
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
              )}
              <span className="text-sm text-muted-foreground">
                {step === 'revealed'
                  ? 'Answer revealed'
                  : step === 'timed-out'
                    ? "Time's up"
                    : 'Answer locked in'}
              </span>
            </PhaseRow>
          )}

          <QuestionGroup
            cursor={cursor}
            question={question}
            step={step}
            pendingPick={pendingPick}
            onPick={pick}
          />

          {/* The line under the grid: one honest sentence per step, and the
              way on when the step has one. */}
          <div className="flex min-h-10 flex-wrap items-center gap-3">
            {note ? (
              <p
                role="alert"
                className="text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                {note}
              </p>
            ) : step === 'sending' ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Sending your answer…
              </p>
            ) : step === 'revealed' ? (
              <VerdictChip
                correct={question.is_correct === true}
                points={question.points ?? 0}
              />
            ) : step === 'answered' ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Check aria-hidden className="size-4 text-primary" />
                Answer locked in
              </p>
            ) : step === 'timed-out' ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Timer aria-hidden className="size-4" />
                Out of time — nothing recorded for this one.
              </p>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Timer aria-hidden className="size-4" />
                Pick one — the faster you answer, the more it scores.
              </p>
            )}

            {(step === 'revealed' || step === 'timed-out' || (step === 'answered' && isLast)) && (
              <div className="ml-auto flex items-center gap-3">
                {isLast && unanswered > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {unanswered} unanswered — {unanswered === 1 ? 'it counts' : 'they count'} as
                    wrong.
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={isLast ? finishNow : advance}
                  disabled={finishing}
                >
                  {finishing ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : isLast ? (
                    <Flag aria-hidden className="size-4" />
                  ) : null}
                  {isLast ? 'See results' : 'Next question'}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // RESUMED WITH NOTHING LEFT TO ANSWER: every question has an answer and
        // only the score is missing.
        <div className="pt-6">
          <QuizMessage
            icon={Flag}
            tone="accent"
            title="Every question answered"
            description={
              attempt.reveal_mode === 'each'
                ? 'Finish to see your score, your points and how fast you were.'
                : 'Finish to see your score and every answer revealed.'
            }
            action={
              <Button size="sm" onClick={finishNow} disabled={finishing}>
                {finishing ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Flag aria-hidden className="size-4" />
                )}
                See results
              </Button>
            }
            footnote={note ?? undefined}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The question and its tiles, and the owner of the keyboard game. Focus moves
 * here on every question CHANGE (never the first mount), and the digits are
 * live only while focus is inside. The ANIMATION is keyed on an inner wrapper,
 * so this instance — and its "did the question change?" memory — survives.
 */
function QuestionGroup({
  cursor,
  question,
  step,
  pendingPick,
  onPick,
}: {
  cursor: number;
  question: QuizAttempt['questions'][number];
  step: Exclude<ReturnType<typeof playStep>, never>;
  pendingPick: number | null;
  onPick: (optionId: number) => void;
}) {
  const headingId = useId();
  const groupRef = useRef<HTMLElement>(null);
  const lastCursor = useRef<number | null>(null);

  // The server serves `position`; never trust array order for a lettered list.
  const options = useMemo(
    () => [...question.options].sort((a, b) => a.position - b.position),
    [question.options],
  );

  useEffect(() => {
    const previous = lastCursor.current;
    lastCursor.current = cursor;
    if (previous !== null && previous !== cursor) groupRef.current?.focus();
  }, [cursor]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (step !== 'open') return;
    // Modified keys belong to the browser and to screen readers, never to us.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length !== 1) return;
    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return;
    event.preventDefault();
    onPick(options[index].id);
  };

  return (
    <section
      ref={groupRef}
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      className={cn('rounded-xl outline-none', FOCUS_RING)}
    >
      <div
        key={cursor}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
      >
        <h1
          id={headingId}
          className="text-xl leading-snug font-semibold text-balance text-foreground sm:text-2xl"
        >
          {question.question}
        </h1>

        <div
          aria-busy={step === 'sending' || undefined}
          className={cn('mt-6 grid gap-3', options.length > 2 && 'sm:grid-cols-2')}
        >
          {options.map((option, index) => (
            <OptionTile
              key={option.id}
              index={index}
              content={option.content}
              state={optionTileState(option.id, question, step, pendingPick)}
              disabled={step !== 'open'}
              onSelect={step === 'open' ? () => onPick(option.id) : undefined}
            />
          ))}
        </div>

        {/* Reinforcement, not the affordance — the lettered square on every
            tile is the affordance. Gated on POINTER CAPABILITY, not width. */}
        <p className="mt-4 hidden text-xs text-muted-foreground/80 [@media(hover:hover)_and_(pointer:fine)]:block">
          Tap an answer, or press{' '}
          <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-sans text-[11px] tabular-nums">
            1
          </kbd>
          –
          <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-sans text-[11px] tabular-nums">
            {options.length}
          </kbd>
          . {SPEED_SCORING_NOTE}
        </p>
      </div>
    </section>
  );
}

/** The reader's own verdict on an `each` attempt — the channel reveal's chip,
 *  with the points the server awarded. Icon AND word, never colour alone. */
function VerdictChip({ correct, points }: { correct: boolean; points: number }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        // `emerald-700` in light: text on a tinted chip, where 600 falls under
        // 4.5:1 (the channel reveal's note).
        correct
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {correct ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
      {correct ? 'Correct' : 'Not this time'}
      {correct && <span className="tabular-nums">+{pointsLabel(points)}</span>}
    </p>
  );
}
