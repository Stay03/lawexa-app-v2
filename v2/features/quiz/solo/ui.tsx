'use client';

import { useEffect, useState, type ComponentProps, type CSSProperties } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { pointsLabel, type SegmentTone } from './model';

/**
 * solo quiz UI kit — the pieces design B1 draws on both of its screens: the
 * raised button, the progress segments, the tick that bursts, the streak
 * chip. The colours and the lip come from `./solo-quiz.css`, which the
 * screens import; everything else is the app's own tokens.
 */

/* ── Buttons ──────────────────────────────────────────────────────────────── */

/**
 * The gold CTA and its quiet twin, raised on B1's lip. The house `Button`
 * underneath, so focus, disabled and the icon slot behave like every other
 * button in v2; only the height, the corner and the lip are B1's.
 */
export function RaisedButton({
  tone = 'primary',
  className,
  ...props
}: ComponentProps<typeof Button> & { tone?: 'primary' | 'quiet' }) {
  return (
    <Button
      {...props}
      variant={tone === 'primary' ? 'default' : 'outline'}
      size="lg"
      className={cn(
        'v2-solo-lip h-14 rounded-2xl px-5 text-base font-bold',
        tone === 'primary'
          ? '[--lip:var(--solo-gold-deep)] hover:bg-primary'
          : 'border-2 border-border bg-card text-foreground hover:bg-card',
        className,
      )}
    />
  );
}

/* ── Progress ─────────────────────────────────────────────────────────────── */

const SEGMENT_TONE: Record<SegmentTone, string> = {
  done: 'bg-primary',
  miss: 'bg-[var(--solo-wrong-deep)]',
  now: 'bg-[linear-gradient(90deg,var(--primary)_0_50%,var(--solo-track)_50%)]',
  todo: 'bg-[var(--solo-track)]',
};

/**
 * One segment per question, over the question: gold for an answer in, red
 * for a miss (an `each` attempt), the one on screen half-lit. The accessible
 * name says where the reader is; the colours are decoration over it.
 */
export function ProgressSegments({
  segments,
  current,
  total,
  className,
}: {
  segments: readonly SegmentTone[];
  /** Index of the question on screen; `total` once every question is in. */
  current: number;
  total: number;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={
        current < total ? `Question ${current + 1} of ${total}` : `${total} of ${total} answered`
      }
      className={cn('flex gap-1.5', className)}
    >
      {segments.map((tone, index) => (
        <span
          key={index}
          className={cn(
            'h-2.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none',
            SEGMENT_TONE[tone],
          )}
        />
      ))}
    </div>
  );
}

/* ── The reveal's marks ───────────────────────────────────────────────────── */

const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/** The tick in its glow ring, and the burst of gold dots that fades out
 *  around it — B1's one celebration, decoration beside the word "Correct". */
export function TickBurst() {
  return (
    <span aria-hidden className="relative size-9 shrink-0">
      <span className="v2-solo-pop absolute inset-0 grid place-items-center rounded-full bg-[var(--solo-right)] text-background shadow-[0_0_0_6px_color-mix(in_oklch,var(--solo-right)_18%,transparent)]">
        <Check className="size-5" strokeWidth={3} />
      </span>
      <BurstDots className="top-4 left-4" />
    </span>
  );
}

/**
 * The eight gold dots that travel 28px out from a tick and fade (B1 motion
 * note 3). `className` places their start at the tick's centre. Hidden under
 * reduced motion by `solo-quiz.css`, where the tick alone says it.
 */
export function BurstDots({ className }: { className: string }) {
  return BURST_ANGLES.map((angle) => (
    <span
      key={angle}
      aria-hidden
      className={cn('v2-solo-dot absolute size-1.5 rounded-full bg-primary', className)}
      style={{ '--a': `${angle}deg` } as CSSProperties}
    />
  ));
}

/** Whether the reader asked for less motion. Read once, on the client. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * "960", counted up from 0 over 600 ms with an ease-out (B1 motion note 4),
 * in the caller's tabular numerals so the width holds while it counts. Under
 * reduced motion the final number shows at once. Decoration over a number
 * the play page's live region already says in words.
 */
export function CountUp({ value, durationMs = 600 }: { value: number; durationMs?: number }) {
  const [still] = useState(prefersReducedMotion);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still) return;
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const done = Math.min(1, (now - started) / durationMs);
      setShown(Math.round(value * (1 - (1 - done) ** 3)));
      if (done < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [still, value, durationMs]);
  return pointsLabel(still ? value : shown);
}

/** "3 in a row", popped in after the tick has landed. */
export function StreakChip({ count, className }: { count: number; className?: string }) {
  return (
    <p
      className={cn(
        'v2-solo-pop v2-solo-pop-late inline-flex items-center gap-2 rounded-full border border-[var(--solo-gold-deep)] bg-primary/10 py-1.5 pr-3 pl-2.5 text-[13px] font-bold text-[var(--solo-gold-text)]',
        className,
      )}
    >
      <span aria-hidden className="flex gap-[3px]">
        {Array.from({ length: Math.min(count, 5) }, (_, index) => (
          <span key={index} className="size-1.5 rounded-full bg-[var(--solo-gold-text)]" />
        ))}
      </span>
      <span className="font-comfortaa text-[15px] tabular-nums">{count}</span> in a row
    </p>
  );
}
