'use client';

import type { QuizAttempt } from '@/types/channel-quiz';
import {
  comparisonLine,
  greeting,
  pointsLabel,
  runTone,
  secondsLabel,
  type AttemptHighlights,
  type AttemptScore,
} from '../model';
import { CountUp } from '../ui';

/**
 * AttemptSummary — the attempt's headline in design B1: the greeting, the
 * points as the hero, one row of three stats, and the one small line about
 * how this run compares with the reader's best.
 *
 * THE POINTS ARE THE STORY. The server scores speed as well as correctness,
 * so the number that sums an attempt up is the points, not a percentage;
 * the ring and the chips of the practice review are gone from here. Every
 * figure is the SERVER's (`points`, `correct_count`, `question_count`, the
 * per-question `is_correct` and `response_ms`); nothing is added up here
 * that the server did not send.
 *
 * THE GREETING IS A JUDGEMENT, AND A SMALL ONE: good is at least half right
 * (`runTone`), said once in the heading and nowhere else. The comparison
 * line is the backend's own block (`comparisonLine`), or nothing on a first
 * attempt, so the screen never invents a best to beat.
 *
 * THE HERO COUNTS UP (B1 motion note 6; Arthur's B1, 24 October 2026): from 0
 * to the total over 800 ms with an ease-out, once, on arrival. The final
 * number is laid out underneath, invisible, and sets the hero's width; the
 * counting number is centred over it and may overflow it by a pixel or two
 * (Comfortaa's digits are not all one width: "6,959" is 3px wider than
 * "9,225", Backend's pictures), so the hero never grows or drifts while it
 * counts. A screen reader hears only the final number.
 * Reduced motion shows the final number at once (`CountUp`).
 */
export function AttemptSummary({
  attempt,
  score,
  highlights,
  viewerName,
}: {
  attempt: QuizAttempt;
  score: AttemptScore;
  highlights: AttemptHighlights;
  /** The session's display name; the greeting takes its first word. */
  viewerName: string | null;
}) {
  const line = comparisonLine(attempt.comparison, score.points);

  return (
    <section
      aria-labelledby="attempt-results-heading"
      className="flex flex-col items-center pt-10 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 sm:pt-14"
    >
      <h1
        id="attempt-results-heading"
        className="font-comfortaa text-[22px] font-bold text-balance text-foreground"
      >
        {greeting(runTone(score), viewerName)}
      </h1>

      <p className="mt-4 font-comfortaa text-[84px] leading-none font-bold tracking-tight text-primary tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
        <span aria-hidden className="relative inline-block">
          <span className="invisible">{pointsLabel(score.points)}</span>
          <span className="absolute inset-0 flex justify-center whitespace-nowrap">
            <CountUp value={score.points} durationMs={800} />
          </span>
        </span>
        <span className="sr-only">{pointsLabel(score.points)}</span>
      </p>
      <p className="mt-2 text-[13px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
        points
      </p>

      {/* One row, three equal cells, number over label, thin dividers. */}
      <ul className="mt-8 flex w-full max-w-[330px] divide-x divide-border">
        <Stat value={`${highlights.correct}/${highlights.total}`} label="right" />
        <Stat value={String(highlights.streak)} label="in a row" />
        <Stat
          value={highlights.fastestMs === null ? 'None' : secondsLabel(highlights.fastestMs)}
          label="fastest"
        />
      </ul>

      {line && <p className="mt-4 text-sm text-muted-foreground">{line}</p>}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className="flex flex-1 flex-col items-center px-1.5 whitespace-nowrap">
      <span className="font-comfortaa text-[22px] font-bold text-foreground tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-[13px] text-muted-foreground">{label}</span>
    </li>
  );
}
