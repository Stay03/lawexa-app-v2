import { CircleAlert, Info, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * CollabFailure — the other half of the old one-size `CollabMessage`: what a
 * surface renders when something went wrong.
 *
 * ── THE RULE FOR WHICH SHAPE, SO NOBODY RE-LITIGATES IT ────────────────────
 * The reason a failure is normally a STRIP is that a full-page panel HIDES
 * whatever did load: a refresh that failed over fifty cached spaces must not
 * replace them with an apology. That reason evaporates when nothing loaded.
 * So the shape follows the SURFACE, not the failure:
 *
 *   `presentation="strip"` (default) — SOMETHING IS RENDERED BESIDE IT. One
 *     line at the top of the surface it interrupted, with the retry beside it.
 *   `presentation="panel"` — THE SCREEN IS OTHERWISE EMPTY. A cold cache, or
 *     every inbox down. There is nothing to hide and nothing else to read, so
 *     the failure gets the room and reads as a destination with a way out —
 *     the designed state the three-state contract asks for. A 40px strip alone
 *     on a blank page is not a state, it is a leftover.
 *
 * ── TWO TONES, BOTH HONEST ─────────────────────────────────────────────────
 *  - `failure` — this surface has nothing, or lost what it was refreshing.
 *    Destructive-tinted, which is the one place red is allowed: red is
 *    reserved for failure and destructive actions, and this is failure.
 *  - `notice`  — PART of the surface is missing while the rest is fine (one of
 *    three invitation inboxes timed out). Neutral, because the reader is not
 *    blocked and a red strip over working content would overstate it.
 *
 * ── THE TINT NEVER TOUCHES THE SENTENCE ────────────────────────────────────
 * The destructive tone colours the BORDER and the GLYPH; the message itself
 * stays on `text-foreground`. Measured over the `/10` ground, `text-destructive`
 * reaches only 4.09:1 in light — under DIRECTION 11's 4.5 floor — while
 * `text-foreground` measures 16.92:1 light and 17.15:1 dark. Quietness comes
 * from size and weight; it may never come from contrast.
 *
 * ── MOTION ─────────────────────────────────────────────────────────────────
 * A fade only, at 150ms. These are STATE PANELS inside a three-state region:
 * the outgoing state is REPLACED by the next one rather than hidden, so there
 * is no "hide" direction to mirror — the symmetry rule governs a persistent
 * element that shows and hides, which this is not. A slide-in would be half of
 * a movement whose other half can never run.
 *
 * `role="alert"` on both shapes: the failure appears in response to something
 * the reader did (an arrival, a retry), and it is the only announcement of it.
 */

const TONE = {
  failure: {
    box: 'border-destructive/30 bg-destructive/10',
    glyph: 'text-destructive',
    tile: 'bg-destructive/10 text-destructive',
    icon: CircleAlert,
  },
  notice: {
    box: 'border-border bg-secondary/40',
    glyph: 'text-muted-foreground',
    tile: 'bg-secondary text-muted-foreground',
    icon: Info,
  },
} as const;

type CollabFailureTone = keyof typeof TONE;

const FADE_IN = 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150';

export function CollabFailure({
  message,
  title = 'Something went wrong',
  presentation = 'strip',
  tone = 'failure',
  icon,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  /** One sentence. The server's own explanation when it gave one. */
  message: string;
  /** The panel's heading. Unused by the strip, which is one line. */
  title?: string;
  /** `panel` ONLY when the surface is otherwise empty — see the docblock. */
  presentation?: 'strip' | 'panel';
  tone?: CollabFailureTone;
  /** Overrides the tone's default glyph. */
  icon?: LucideIcon;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  const Icon = icon ?? TONE[tone].icon;

  if (presentation === 'panel') {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center px-6 pb-12 pt-10 text-center',
          FADE_IN,
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-12 items-center justify-center rounded-2xl',
            TONE[tone].tile,
          )}
        >
          <Icon className="size-6" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
        {onRetry ? (
          <Button
            variant="outline"
            size="sm"
            className="v2-interactive mt-4"
            onClick={onRetry}
          >
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 text-sm text-foreground',
        FADE_IN,
        TONE[tone].box,
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-4 shrink-0', TONE[tone].glyph)} />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="v2-interactive shrink-0"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
