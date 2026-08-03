import Link from 'next/link';
import { Check, Clock, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  formatDurationMs,
  formatSessionDate,
  parseScore,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import type { QuizSession } from '@/types/quiz';

/**
 * ResultsSummary — the session's headline: the score, what it is made of, and
 * the two things worth doing next.
 *
 * ── THE RING IS A METER, AND IT IS BUILT LIKE ONE ───────────────────────────
 * One ratio against a fixed limit (0–100%), so: ONE hue, a filled arc for the
 * value and a lighter step of the SAME hue for the track — never a second
 * colour, and never an auto-scaled arc. The SVG is `aria-hidden` under a real
 * `role="img"` label, so a screen reader hears "Score: 67 percent" rather than
 * a pile of unlabelled circles.
 *
 * ── THE BIG NUMBER WEARS PLAIN INK, NOT A GRADE COLOUR ──────────────────────
 * v1 tinted it green / amber / grey by band (`scoreBandClasses`). Two problems:
 * text should never wear the data colour, and banding a PRACTICE score
 * green-vs-red passes a judgement the data does not support — 40% on hard
 * questions is not a failure. The counts beside it say what happened and the
 * reader draws the conclusion. `tabular-nums` is also deliberately absent here:
 * equal-width digits make a large standalone number look loose, so this uses
 * the font's proportional figures (tabular stays for the small aligned values).
 *
 * ── A SESSION THAT ANSWERED NOTHING SHOWS "—", NOT "0%" ─────────────────────
 * The same zero-vs-null discipline the stats page applies: no answers means
 * there is no score, and printing 0% would report a failure that never happened.
 */
export function ResultsSummary({
  session,
  meanTimeMs,
}: {
  session: QuizSession;
  /** Mean answer time across the session, or null when nothing was answered. */
  meanTimeMs: number | null;
}) {
  const percent = parseScore(session.score_percentage);
  const answered = session.answered_count;
  const correct = session.correct_count;
  const incorrect = Math.max(0, answered - correct);
  const date = session.completed_at
    ? formatSessionDate(session.completed_at)
    : null;
  const duration = sessionDurationMs(session.started_at, session.completed_at);

  const timing = [
    duration !== null ? formatDurationMs(duration) : null,
    meanTimeMs !== null ? `~${formatDurationMs(meanTimeMs)} per question` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <div className="rounded-xl border border-border bg-card p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 sm:p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:text-left">
        <ScoreRing percent={percent} answered={answered} />

        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Session complete
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {answered === 0
              ? 'No questions were answered in this session.'
              : `${correct} of ${answered} correct`}
            {date ? ` · ${date}` : ''}
          </p>

          {answered > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <Chip icon={Check} tone="positive" label={`${correct} correct`} />
              <Chip icon={X} tone="negative" label={`${incorrect} incorrect`} />
              {timing ? <Chip icon={Clock} tone="quiet" label={timing} /> : null}
            </div>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:flex-col">
          <Button asChild size="sm" className="flex-1">
            <Link href="/quiz">Practise again</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href="/quiz/history">Past sessions</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({
  percent,
  answered,
}: {
  percent: number;
  answered: number;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const rounded = Math.round(clamped);

  return (
    <div
      role="img"
      aria-label={
        answered === 0
          ? 'No score — nothing was answered in this session'
          : `Score: ${rounded} percent`
      }
      className="relative size-28 shrink-0"
    >
      <svg aria-hidden viewBox="0 0 120 120" className="size-full -rotate-90">
        {/* Track — a lighter step of the SAME hue, never a neutral grey. */}
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          className="stroke-primary/15"
        />
        {answered > 0 ? (
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        ) : null}
      </svg>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-foreground"
      >
        {answered === 0 ? '—' : `${rounded}%`}
      </span>
    </div>
  );
}

const CHIP_TONE = {
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  negative: 'bg-destructive/10 text-destructive',
  quiet: 'bg-secondary text-muted-foreground',
} as const;

function Chip({
  icon: Icon,
  tone,
  label,
}: {
  icon: typeof Check;
  tone: keyof typeof CHIP_TONE;
  label: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        CHIP_TONE[tone],
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
