import { cn } from '@/lib/utils';
import type { ThreadStatusValue } from '@/types/collab';
import {
  isThreadStatusValue,
  threadStatusLabel,
} from '@/v2/features/channels/thread-status-model';

/**
 * ThreadStatusChip — a thread's status as a dot and a word. First drawn from
 * Stay's mock (16 October 2026); colours revised by Arthur the same day:
 * Working blue, Needs Action amber, On Hold a calm slate, Completed green,
 * Closed grey and muted; Queued violet, calm and apart from On Hold's slate
 * (16 October 2026, the evening). Needs Action was FILLED, the one that stood
 * out; on Arthur's "too much gold" Stay picked option 1, "all tinted": it
 * takes the same faint tint as the others, with a darker amber word, at the
 * same size. Pure and presentational. The dot is
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
 *
 * `fold` is for a thread list row on a phone, where the title shares a 390px
 * line with the chip and must keep about 20 characters (techlead, 16 October
 * 2026). Below `md:` the person hides (the thread's header and its menu name
 * them), and the suffix sits in a one-line wrapping box with the pill: when
 * the row has room it shows, and when it does not it wraps out of sight
 * whole, never as a "· q…" stub. The box gives way fifty times faster than
 * the title, so the suffix goes before the title loses a letter. From `md:`
 * up the row is as before.
 */

const TONE: Readonly<Record<ThreadStatusValue, { chip: string; dot: string }>> = {
  queued: {
    chip: 'bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    dot: 'bg-violet-500 dark:bg-violet-400',
  },
  working: {
    chip: 'bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  needs_action: {
    chip: 'bg-amber-500/14 text-amber-800 dark:bg-amber-400/14 dark:text-amber-300',
    dot: 'bg-amber-600 dark:bg-amber-400',
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

/** The dot alone, for a list of options whose words sit beside it: each
 *  status's own dot, the same as on its pill. */
const OPTION_DOT: Readonly<Record<ThreadStatusValue, string>> = {
  queued: TONE.queued.dot,
  working: TONE.working.dot,
  needs_action: TONE.needs_action.dot,
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

/** A row's pill and suffix below `md:`: one 20px line, the suffix wrapping out
 *  of sight whole when the row has no room. `min-w-min` keeps the pill: a box
 *  that clips has no automatic minimum width, and a long title squeezed it to
 *  nothing (the 390px check, 16 October 2026). */
const FOLD_BOX =
  'max-md:flex max-md:h-5 max-md:min-w-min max-md:shrink-[50] max-md:flex-wrap max-md:overflow-hidden';

/** The pill's column keeps its content; the suffix's gives way to nothing. */
const FIT_GRID = 'inline-grid grid-cols-[auto_minmax(0,max-content)]';

export function ThreadStatusChip({
  value,
  person = null,
  size = 'sm',
  quiet = null,
  fit = false,
  fold = false,
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
  /** A list row: below `md:` the person hides and the suffix shows only whole. */
  fold?: boolean;
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
        <span className={cn('min-w-0 max-w-32 truncate', fold && 'max-md:hidden')}>
          {`· ${person}`}
        </span>
      ) : null}
    </span>
  );
  if (!quiet) return chip;
  return (
    <span
      className={cn(
        'items-center gap-1',
        fit ? FIT_GRID : 'inline-flex shrink-0',
        fold && FOLD_BOX,
        className,
      )}
    >
      {chip}
      <span
        className={cn(
          'text-[11px] whitespace-nowrap text-muted-foreground',
          // A phone's bar is the pill and the chevron alone: a "· quiet …"
          // stub there read as noise (techlead, 16 October 2026). The trigger's
          // spoken label still says it.
          fit && 'min-w-0 truncate max-md:hidden',
        )}
      >
        {`· ${quiet}`}
      </span>
    </span>
  );
}
