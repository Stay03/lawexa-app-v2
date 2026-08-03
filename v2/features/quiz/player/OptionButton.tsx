import { Check, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * OptionButton — one answer. Tapping it SUBMITS (there is no separate confirm
 * step); the parent owns the request.
 *
 * ── THE KEY HINT IS A REAL AFFORDANCE, NOT DECORATION ───────────────────────
 * The leading square carries the option's number, and pressing that number key
 * picks this option. It doubles as the selected/pending indicator, so the row
 * gains a shortcut without gaining a second piece of furniture: at rest it is
 * the digit, on selection it becomes a tick, and while the answer is on the
 * wire it becomes a spinner. One element, three honest states.
 *
 * The hint is `aria-hidden` and the shortcut is instead declared with
 * `aria-keyshortcuts`, which is what assistive tech actually reads for this —
 * a screen reader announcing "1" before every option would bury the answer text
 * it is there to read.
 *
 * ── THE PENDING BEAT IS VISIBLE AND NON-DESTRUCTIVE ─────────────────────────
 * While a submit is in flight the whole group locks (`disabled`), the chosen
 * row keeps full contrast and spins, and the others recede to 55% — so the
 * reader can see WHICH answer is being recorded, not just that something is
 * happening. Nothing moves: no layout change, no reflow, so an auto-advance
 * that lands in 200ms does not read as a flicker.
 */
export function OptionButton({
  label,
  index,
  selected,
  pending,
  disabled,
  onSelect,
}: {
  label: string;
  /** 0-based position, which is also the `index + 1` shortcut key. */
  index: number;
  selected: boolean;
  /** This option is the one currently being submitted. */
  pending: boolean;
  /** The whole group is locked (a submit is in flight). */
  disabled: boolean;
  onSelect: () => void;
}) {
  const key = String(index + 1);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-keyshortcuts={key}
      className={cn(
        'v2-interactive group flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-all duration-200 sm:p-4',
        'disabled:pointer-events-none',
        selected
          ? 'border-primary/50 bg-primary/5'
          : 'border-border hover:border-border hover:bg-secondary/50',
        disabled && !selected && 'opacity-55',
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors',
          selected
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground group-hover:text-foreground',
        )}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : selected ? (
          <Check className="size-3.5" />
        ) : (
          key
        )}
      </span>
      <span className="text-sm leading-relaxed text-foreground">{label}</span>
    </button>
  );
}
