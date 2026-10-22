'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Flag, Loader2, Timer, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { QuizAttempt, QuizAttemptQuestion, QuizScenario } from '@/types/channel-quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { QuizMessage } from '../../ui/QuizMessage';
import {
  answerRefusalCopy,
  attemptPoints,
  attemptResultsHref,
  END_MODE_ADVANCE_MS,
  nextUnanswered,
  optionTileState,
  orderedQuestions,
  playStep,
  pointsLabel,
  progressSegments,
  questionDeadlineMs,
  questionKicker,
  responseMsFor,
  scenarioFor,
  secondsLabel,
  streakEndingAt,
  unansweredCount,
  type PlayStep,
} from '../model';
import { useAnswerAttempt, useFinishAttempt } from '../mutations';
import { ProgressSegments, RaisedButton, StreakChip, TickBurst } from '../ui';
import { AttemptOptionTile } from './AttemptOptionTile';
import { AttemptTimer, FrozenRail } from './AttemptTimer';
import { SOLO_PLAY_COLUMN } from './states';
import '../solo-quiz.css';

/**
 * AttemptPlay — the play loop of one attempt, from the question it resumes on
 * to Finish, drawn in design B1 (Arthur and Stay, 22 October 2026): the
 * segments and the thin clock over the question, raised tiles, and a sheet
 * that rises from the bottom with the verdict.
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
 * On an `each` attempt the receipt is the reveal: the tiles turn, the clock
 * freezes at the time the answer took, and the sheet rises with the verdict,
 * the points, the streak (or the answer, when the pick was wrong) and
 * Continue. On an `end` attempt the receipt carries counts only, so the
 * locked tile is held a beat and the next question arrives on its own; the
 * verdicts wait for the results, and only the last question gets a sheet,
 * with See results on it.
 *
 * ── A 409 IS NOT A FAILURE ─────────────────────────────────────────────────
 * The server already has this answer (a second tab), or has already scored
 * the attempt. The mutation re-reads the attempt; the question then shows its
 * verdict, or the screen above sends the reader to the results. No sentence
 * is printed for it (`answerRefusalCopy`). Everything else is said in the
 * foot, in place: this surface has no toasts.
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
  /** The one sentence in the foot for a refusal, cleared on every move. */
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
  const segments = progressSegments(questions, cursor);

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

  // The sheet rises for a verdict, for a question lost to the clock, and for
  // the last answer of an `end` attempt, where See results is the only move.
  const sheet =
    step === 'revealed' || step === 'timed-out' || (step === 'answered' && isLast);

  return (
    <div className={SOLO_PLAY_COLUMN}>
      {/* STICKY, NOT FIXED — pins inside the shell's one scroll container.
          The quiz's name stays on the page: the bar carries no title for
          this address (`pushed-route.ts`). */}
      <header className="sticky top-0 z-10 -mx-4 bg-background/85 px-4 pt-3 pb-2.5 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-muted-foreground">{attempt.quiz.title}</p>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {/* Mounted from the first frame, EMPTY until an answer is recorded
                in this mount — a live region only reliably announces changes
                it is present for (the practice `ScoreChip` rule). */}
            <span role="status" aria-live="polite" className="sr-only">
              {announcement}
            </span>
            {attempt.reveal_mode === 'each' ? (
              <span aria-hidden>
                <span className="font-comfortaa text-base font-bold text-foreground">
                  {pointsLabel(points)}
                </span>{' '}
                pts
              </span>
            ) : (
              <span aria-hidden>
                {attempt.answered_count}/{total} answered
              </span>
            )}
          </p>
        </div>

        <ProgressSegments className="mt-3" segments={segments} current={cursor} total={total} />

        {/* The one fixed-height rail under the segments: draining while the
            question is open, frozen with the answer's time after. */}
        {question && step && (
          <div className="mt-2.5">
            {step === 'open' || step === 'sending' ? (
              <AttemptTimer
                key={cursor}
                openedAtMs={place.openedAtMs}
                limitSeconds={question.time_limit_seconds}
              />
            ) : step === 'revealed' ? (
              <FrozenRail
                fraction={1 - (question.response_ms ?? 0) / (question.time_limit_seconds * 1000)}
                label={secondsLabel(question.response_ms ?? 0)}
              />
            ) : step === 'timed-out' ? (
              <FrozenRail fraction={0} label="Time's up" />
            ) : (
              <FrozenRail fraction={1} label="Locked in" />
            )}
          </div>
        )}
      </header>

      {question && step ? (
        <>
          <QuestionGroup
            cursor={cursor}
            question={question}
            scenario={scenarioFor(attempt, question)}
            step={step}
            pendingPick={pendingPick}
            onPick={pick}
          />

          <div className="mt-auto pt-6">
            {sheet ? (
              <RevealSheet
                step={step}
                question={question}
                streak={
                  question.is_correct === true
                    ? streakEndingAt(questions, cursor)
                    : streakEndingAt(questions, cursor - 1)
                }
                isLast={isLast}
                unanswered={unanswered}
                finishing={finishing}
                note={note}
                onContinue={isLast ? finishNow : advance}
              />
            ) : (
              <Foot step={step} note={note} optionCount={question.options.length} />
            )}
          </div>
        </>
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
              <RaisedButton onClick={finishNow} disabled={finishing}>
                {finishing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                See results
              </RaisedButton>
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
  scenario,
  step,
  pendingPick,
  onPick,
}: {
  cursor: number;
  question: QuizAttemptQuestion;
  scenario: QuizScenario | null;
  step: PlayStep;
  pendingPick: number | null;
  onPick: (optionId: number) => void;
}) {
  const headingId = useId();
  const groupRef = useRef<HTMLElement>(null);
  const lastCursor = useRef<number | null>(null);

  // The server serves `position`; never trust array order for a numbered list.
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
      className={cn('rounded-xl pt-7 outline-none', FOCUS_RING)}
    >
      <div
        key={cursor}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
      >
        <p className="text-[13px] font-semibold text-muted-foreground">
          {questionKicker(question.type)}
        </p>

        {/* The fact pattern the question is about, once, over it. */}
        {scenario && (
          <div className="mt-3 border-l-[3px] border-primary pl-3.5 text-[15px] leading-relaxed text-muted-foreground">
            {scenario.title && <p className="font-semibold text-foreground">{scenario.title}</p>}
            <p className="whitespace-pre-line">{scenario.passage}</p>
          </div>
        )}

        <h1
          id={headingId}
          className={cn(
            'mt-2.5 font-bold tracking-tight text-balance text-foreground',
            scenario ? 'text-xl leading-snug sm:text-2xl' : 'text-2xl leading-tight sm:text-3xl',
          )}
        >
          {question.question}
        </h1>

        <div
          aria-busy={step === 'sending' || undefined}
          className="mt-7 grid gap-3.5 sm:grid-cols-2"
        >
          {options.map((option, index) => (
            <AttemptOptionTile
              key={option.id}
              index={index}
              content={option.content}
              look={question.type === 'true_false' ? (index === 0 ? 'true' : 'false') : 'card'}
              state={optionTileState(option.id, question, step, pendingPick)}
              disabled={step !== 'open'}
              onSelect={step === 'open' ? () => onPick(option.id) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The line at the foot while the question is open: how to answer, a send in
 * flight, a pick locked in, or the one honest sentence for a refusal. Keyed
 * on the pointer, not the width: a finger taps, a mouse clicks or presses.
 */
function Foot({
  step,
  note,
  optionCount,
}: {
  step: PlayStep;
  note: string | null;
  optionCount: number;
}) {
  return (
    <div className="flex min-h-10 items-center gap-3 text-[13px] text-muted-foreground">
      {note ? (
        <p
          role="alert"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {note}
        </p>
      ) : step === 'sending' ? (
        <p className="inline-flex items-center gap-1.5">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Sending your answer…
        </p>
      ) : step === 'answered' ? (
        <p className="inline-flex items-center gap-1.5">
          <Check aria-hidden className="size-4 text-primary" />
          Locked in
        </p>
      ) : (
        <p>
          <span className="[@media(hover:hover)_and_(pointer:fine)]:hidden">Tap to answer</span>
          <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">
            Click an answer, or press <Key>1</Key> to <Key>{optionCount}</Key>. The first pick
            counts.
          </span>
        </p>
      )}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-sans text-xs font-bold text-foreground tabular-nums">
      {children}
    </kbd>
  );
}

/* ── The sheet ────────────────────────────────────────────────────────────── */

type SheetTone = 'right' | 'wrong' | 'quiet';

const SHEET_TONE: Record<SheetTone, string> = {
  right: 'border-[var(--solo-right)] bg-[var(--solo-right-ink)]',
  wrong: 'border-[var(--solo-wrong)] bg-[var(--solo-wrong-ink)]',
  quiet: 'border-border bg-card',
};

const HEAD_TONE: Record<SheetTone, string> = {
  right: 'text-[var(--solo-right)]',
  wrong: 'text-[var(--solo-wrong)]',
  quiet: 'text-foreground',
};

/**
 * The sheet that rises from the bottom once the question is over: the
 * verdict in a word and a mark (never colour alone), the points the server
 * awarded and how long the answer took, the streak when there is one or the
 * right answer when the pick was wrong, and the one way on. `aria-live`, so
 * the verdict is read out as it lands.
 */
function RevealSheet({
  step,
  question,
  streak,
  isLast,
  unanswered,
  finishing,
  note,
  onContinue,
}: {
  step: PlayStep;
  question: QuizAttemptQuestion;
  /** The run of right answers ending here (right), or just before (wrong). */
  streak: number;
  isLast: boolean;
  unanswered: number;
  finishing: boolean;
  note: string | null;
  onContinue: () => void;
}) {
  const revealed = step === 'revealed';
  const tone: SheetTone = revealed ? (question.is_correct === true ? 'right' : 'wrong') : 'quiet';
  const correctOption =
    question.options.find((option) => option.id === question.correct_option_id) ?? null;
  const took = secondsLabel(question.response_ms ?? 0);

  return (
    <section
      aria-live="polite"
      className={cn(
        'v2-solo-rise sticky bottom-0 z-10 -mx-4 -mb-6 rounded-t-3xl border-t-2 px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        SHEET_TONE[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className={cn('flex items-center gap-2.5 text-xl font-bold', HEAD_TONE[tone])}>
          {tone === 'right' ? (
            <TickBurst />
          ) : tone === 'wrong' ? (
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--solo-wrong)] text-background"
            >
              <X className="size-4" strokeWidth={3} />
            </span>
          ) : (
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
            >
              {step === 'timed-out' ? <Timer className="size-4" /> : <Check className="size-4" />}
            </span>
          )}
          {tone === 'right'
            ? 'Correct'
            : tone === 'wrong'
              ? 'Not quite'
              : step === 'timed-out'
                ? "Time's up"
                : 'All answered'}
        </h2>

        {revealed && (
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'font-comfortaa text-3xl leading-none font-bold tabular-nums',
                HEAD_TONE[tone],
              )}
            >
              +{pointsLabel(question.points ?? 0)}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-muted-foreground">
              {tone === 'wrong' && streak >= 2 ? `streak ends at ${streak}` : `in ${took}`}
            </p>
          </div>
        )}
      </div>

      {tone === 'right' && streak >= 2 && <StreakChip className="mt-3.5" count={streak} />}

      {tone === 'wrong' && correctOption && (
        <p className="mt-2.5 text-[15px] leading-relaxed text-foreground">
          <b className="font-bold text-[var(--solo-right)]">{correctOption.content}</b> was the
          answer.
        </p>
      )}

      {step === 'timed-out' && (
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
          Out of time — nothing recorded for this one, and it counts as wrong.
        </p>
      )}

      {isLast && unanswered > 0 && (
        <p className="mt-2.5 text-[13px] text-muted-foreground">
          {unanswered} unanswered — {unanswered === 1 ? 'it counts' : 'they count'} as wrong.
        </p>
      )}

      {note && (
        <p
          role="alert"
          className="mt-2.5 text-[13px] text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {note}
        </p>
      )}

      <RaisedButton className="mt-4 w-full" onClick={onContinue} disabled={finishing}>
        {finishing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {isLast ? 'See results' : 'Continue'}
      </RaisedButton>
    </section>
  );
}
