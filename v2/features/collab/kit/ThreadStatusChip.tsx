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
 * `fit` is for a thread's header, where the chip shares a line with the
 * title: it shrinks to the room it is given instead of pushing the title to
 * "Te…" or running under the faces (techlead's pictures, 16 October 2026). The
 * suffix gives way first, then the person; the word itself is never cut. A
 * row keeps the chip whole, as before.
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
  /** Shrinks to its line, suffix first, then the person; never the word. */
  fit?: boolean;
  className?: string;
}) {
  if (!isThreadStatusValue(value)) return null;
  const chip = (
    <span
      className={cn(
        'inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        fit && 'shrink',
        size === 'md' ? 'h-6 px-2.5 text-xs' : 'h-5 px-2 text-[11px]',
        TONE[value].chip,
        quiet ? null : className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', TONE[value].dot)}
      />
      <span className="shrink-0">{threadStatusLabel(value)}</span>
      {person ? (
        <span className="min-w-0 max-w-32 truncate">{`· ${person}`}</span>
      ) : null}
    </span>
  );
  if (!quiet) return chip;
  return (
    <span className={cn('inline-flex min-w-0 shrink-0 items-center gap-1', fit && 'shrink', className)}>
      {chip}
      {/* Weighted to give way well before the person's name does. */}
      <span
        className={cn(
          'text-[11px] whitespace-nowrap text-muted-foreground',
          fit && 'min-w-0 shrink-[8] truncate',
        )}
      >
        {`· ${quiet}`}
      </span>
    </span>
  );
}
