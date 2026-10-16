import { cn } from '@/lib/utils';
import type { ThreadStatusValue } from '@/types/collab';
import { threadStatusLabel } from '@/v2/features/channels/thread-status-model';

/**
 * ThreadStatusChip — a thread's status as a dot and a word (Stay, 16 October
 * 2026, from the thread-status mock): Running blue, Waiting amber, Blocked
 * red, Done green, Closed grey. Pure and presentational. The dot is
 * `aria-hidden`; the word is the chip's text, so the chip reads as "Running"
 * and the colour is never the only signal.
 *
 * Each tone is a Tailwind palette class with its `dark:` twin, the house
 * pattern for tinted pills (the case page's amber pill, the quiz's green), so
 * the chip holds its contrast in both themes. `quiet` hangs the stale suffix
 * ("quiet 1d") after the chip in muted ink.
 */

const TONE: Readonly<Record<ThreadStatusValue, { chip: string; dot: string }>> = {
  running: {
    chip: 'bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  waiting: {
    chip: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  blocked: {
    chip: 'bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-300',
    dot: 'bg-red-500 dark:bg-red-400',
  },
  done: {
    chip: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  closed: {
    chip: 'bg-secondary text-muted-foreground',
    dot: 'bg-muted-foreground/70',
  },
};

/** Just the dot, for a list of options whose words sit beside it. */
export function ThreadStatusDot({
  value,
  className,
}: {
  value: ThreadStatusValue;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn('size-1.5 shrink-0 rounded-full', TONE[value].dot, className)}
    />
  );
}

export function ThreadStatusChip({
  value,
  size = 'sm',
  quiet = null,
  className,
}: {
  value: ThreadStatusValue;
  /** `sm` on a row (20px), `md` in a thread's header (24px). */
  size?: 'sm' | 'md';
  /** The stale suffix, e.g. "quiet 1d"; `null` draws none. */
  quiet?: string | null;
  className?: string;
}) {
  const chip = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'md' ? 'h-6 px-2.5 text-xs' : 'h-5 px-2 text-[11px]',
        TONE[value].chip,
        quiet ? null : className,
      )}
    >
      <ThreadStatusDot value={value} />
      {threadStatusLabel(value)}
    </span>
  );
  if (!quiet) return chip;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1', className)}>
      {chip}
      <span className="text-[11px] whitespace-nowrap text-muted-foreground">
        {`· ${quiet}`}
      </span>
    </span>
  );
}
