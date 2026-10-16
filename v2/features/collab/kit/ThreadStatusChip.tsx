import { cn } from '@/lib/utils';
import type { ThreadStatusValue } from '@/types/collab';
import {
  isThreadStatusValue,
  threadStatusLabel,
} from '@/v2/features/channels/thread-status-model';

/**
 * ThreadStatusChip — a thread's status as a dot and a word. First drawn from
 * Stay's mock (16 October 2026); colours revised by Arthur the same day:
 * Working blue, Needs Action amber and FILLED (the one that stands out a
 * little more, with no glow and no motion), On Hold a calm slate, Completed
 * green, Closed grey and muted. Pure and presentational. The dot is
 * `aria-hidden`; the word is the chip's text, so the colour is never the only
 * signal. A value this app does not know draws nothing.
 *
 * Each tone is a Tailwind palette class with its `dark:` twin, the house
 * pattern for tinted pills, so the chip holds its contrast in both themes.
 * `person` follows the word after a middle dot ("Needs Action · Tolu");
 * `quiet` hangs the stale suffix ("quiet 1d") after the chip in muted ink.
 *
 * `fit` is for a thread's header, where the status has a line of its own
 * under the title: only the "quiet 1d" suffix gives way to a narrow line,
 * because a Needs Action never leaves people guessing who must act (Arthur,
 * via the techlead, 16 October 2026). The pill, its word and its person stay
 * whole. A row keeps the suffix whole too, as before.
 *
 * THE FLOOR IS A GRID TRACK, NOT `min-w-0`. With `fit` the pill and the
 * suffix are a two-column grid: the pill in an `auto` column, the suffix in a
 * `minmax(0, max-content)` one. A grid's smallest size is the sum of its
 * columns' minimums, so it shrinks to exactly the pill and no further, and
 * every box around it keeps `min-width: auto` and inherits that floor. A
 * `min-w-0` on that chain lets the pill shrink under its own word, which the
 * second round of pictures showed.
 */

const TONE: Readonly<Record<ThreadStatusValue, { chip: string; dot: string }>> = {
  working: {
    chip: 'bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  needs_action: {
    chip: 'bg-amber-400 text-amber-950 dark:bg-amber-400 dark:text-amber-950',
    dot: 'bg-amber-950/70',
  },
  on_hold: {
    chip: 'bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
  completed: {
    chip: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  closed: {
    chip: 'bg-secondary text-muted-foreground',
    dot: 'bg-muted-foreground/70',
  },
};

/**
 * The dot alone, for a list of options whose words sit beside it. Needs
 * Action's filled amber reads as the dot here, since there is no pill behind
 * it.
 */
const OPTION_DOT: Readonly<Record<ThreadStatusValue, string>> = {
  working: TONE.working.dot,
  needs_action: 'bg-amber-500 dark:bg-amber-400',
  on_hold: TONE.on_hold.dot,
  completed: TONE.completed.dot,
  closed: TONE.closed.dot,
};

export function ThreadStatusDot({
  value,
  className,
}: {
  value: ThreadStatusValue;
  className?: string;
}) {
  if (!isThreadStatusValue(value)) return null;
  return (
    <span
      aria-hidden
      className={cn('size-1.5 shrink-0 rounded-full', OPTION_DOT[value], className)}
    />
  );
}

/** The pill's column keeps its content; the suffix's gives way to nothing. */
const FIT_GRID = 'inline-grid grid-cols-[auto_minmax(0,max-content)]';

export function ThreadStatusChip({
  value,
  person = null,
  size = 'sm',
  quiet = null,
  fit = false,
  className,
}: {
  value: ThreadStatusValue;
  /** Needs Action's person, printed after a middle dot. */
  person?: string | null;
  /** `sm` on a row (20px), `md` in a thread's header (24px). */
  size?: 'sm' | 'md';
  /** The stale suffix, e.g. "quiet 1d"; `null` draws none. */
  quiet?: string | null;
  /** Gives way to a narrow line by trimming the suffix only. */
  fit?: boolean;
  className?: string;
}) {
  if (!isThreadStatusValue(value)) return null;
  const chip = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        // Never `min-w-0` with `fit`: in the grid it zeroes the pill's column
        // and the pill draws under its own word (the phone pictures, round 5).
        !fit && 'min-w-0',
        size === 'md' ? 'h-6 px-2.5 text-xs' : 'h-5 px-2 text-[11px]',
        TONE[value].chip,
        quiet ? null : className,
      )}
    >
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', TONE[value].dot)}
        />
        {threadStatusLabel(value)}
      </span>
      {person ? (
        <span className="min-w-0 max-w-32 truncate">{`· ${person}`}</span>
      ) : null}
    </span>
  );
  if (!quiet) return chip;
  return (
    <span
      className={cn(
        'items-center gap-1',
        fit ? FIT_GRID : 'inline-flex shrink-0',
        className,
      )}
    >
      {chip}
      <span
        className={cn(
          'text-[11px] whitespace-nowrap text-muted-foreground',
          fit && 'min-w-0 truncate',
        )}
      >
        {`· ${quiet}`}
      </span>
    </span>
  );
}
