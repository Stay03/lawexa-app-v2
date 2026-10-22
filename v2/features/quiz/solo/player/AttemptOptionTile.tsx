'use client';

import { Check, Diamond, Triangle, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { OptionState } from '@/v2/features/channels/quiz/ui';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * AttemptOptionTile — one answer in design B1: a raised card for a pick-one
 * question, a tall blue or coral tile for true or false.
 *
 * ONE ELEMENT CARRIES THE WHOLE LIFE OF AN OPTION — offered, chosen, locked,
 * judged — so nothing moves between the question and its reveal (the channel
 * game's rule, kept). The states are the channel game's own `OptionState`,
 * painted the B1 way: a right answer turns green and gets a tick, a wrong
 * pick turns red and gets a cross, every other tile drops flat and dims.
 *
 * NEVER COLOUR ALONE (WCAG 1.4.1): a revealed tile carries a screen-reader
 * sentence naming its verdict beside the tick or the cross, and the true and
 * false tiles differ by glyph as well as by colour.
 *
 * THE DIGIT IS DRAWN FOR A POINTER ONLY: the key hint on the right of a card
 * answers the keyboard, so it shows where there is one to speak of (the
 * `hover: hover` + `pointer: fine` gate the practice player uses).
 */

export type TileLook = 'card' | 'true' | 'false';

const REVEAL_LABEL: Partial<Record<OptionState, string>> = {
  correct: 'Correct answer',
  'wrong-pick': 'Your answer — incorrect',
  missed: 'Not the answer',
};

const CARD_TONE: Record<OptionState, string> = {
  idle: 'border-border bg-card text-foreground hover:border-muted-foreground/50',
  picked: 'border-primary bg-primary/10 text-foreground [--lip:var(--solo-gold-deep)]',
  'locked-other': 'v2-solo-flat border-border bg-card text-foreground opacity-35',
  correct:
    'border-[var(--solo-right)] bg-[var(--solo-right-ink)] text-foreground [--lip:var(--solo-right-deep)]',
  'wrong-pick':
    'border-[var(--solo-wrong)] bg-[var(--solo-wrong-ink)] text-foreground [--lip:var(--solo-wrong-deep)]',
  missed: 'v2-solo-flat border-border bg-card text-foreground opacity-35',
};

const TALL_COLOUR: Record<Exclude<TileLook, 'card'>, string> = {
  true: 'border-transparent bg-[var(--solo-blue)] [--lip:var(--solo-blue-deep)]',
  false: 'border-transparent bg-[var(--solo-coral)] [--lip:var(--solo-coral-deep)]',
};

const TALL_TONE: Record<OptionState, string> = {
  idle: '',
  picked: 'ring-4 ring-white/40',
  'locked-other': 'v2-solo-flat opacity-35',
  correct: 'ring-4 ring-[var(--solo-right)]',
  'wrong-pick': 'ring-4 ring-[var(--solo-wrong)]',
  missed: 'v2-solo-flat opacity-35',
};

export function AttemptOptionTile({
  index,
  content,
  look,
  state,
  disabled,
  onSelect,
  badge = null,
}: {
  index: number;
  content: string;
  look: TileLook;
  state: OptionState;
  /** Locked: a pick in flight or held. A tile with no `onSelect` that is not
   *  disabled is PASSIVE: it takes no pick, and its tap reaches the screen. */
  disabled?: boolean;
  onSelect?: () => void;
  /** The points this tile won, on the tapped tile of a verdict ("+853"). */
  badge?: string | null;
}) {
  const interactive = !!onSelect && !disabled;
  const tall = look !== 'card';

  return (
    <button
      type="button"
      onClick={interactive ? onSelect : undefined}
      disabled={disabled === true}
      aria-disabled={interactive ? undefined : true}
      tabIndex={interactive ? undefined : -1}
      aria-pressed={state === 'picked' || state === 'wrong-pick' ? true : undefined}
      className={cn(
        'v2-interactive v2-solo-lip relative flex w-full items-center gap-4 rounded-2xl border-2 text-left',
        tall
          ? 'min-h-24 px-5 py-4 text-2xl font-bold text-white sm:min-h-28'
          : 'min-h-16 px-4 py-3 text-[15px] leading-snug font-semibold',
        tall ? cn(TALL_COLOUR[look], TALL_TONE[state]) : CARD_TONE[state],
        interactive ? 'cursor-pointer' : 'cursor-default',
        FOCUS_RING,
      )}
    >
      {tall && (
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20"
        >
          {look === 'true' ? (
            <Triangle className="size-5 fill-current" />
          ) : (
            <Diamond className="size-5 fill-current" />
          )}
        </span>
      )}

      <span className="min-w-0 flex-1 break-words">
        {content}
        {REVEAL_LABEL[state] && <span className="sr-only">. {REVEAL_LABEL[state]}</span>}
      </span>

      {badge && (
        <span
          aria-hidden
          className={cn(
            'shrink-0 font-comfortaa text-lg font-bold tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:duration-200',
            tall ? 'text-white' : state === 'correct' ? 'text-[var(--solo-right)]' : 'text-[var(--solo-wrong)]',
          )}
        >
          {badge}
        </span>
      )}

      {state === 'correct' || state === 'wrong-pick' ? (
        <span
          aria-hidden
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full text-background',
            state === 'correct' ? 'bg-[var(--solo-right)]' : 'bg-[var(--solo-wrong)]',
            tall && 'ring-2 ring-white/70',
          )}
        >
          {state === 'correct' ? (
            <Check className="size-3.5" strokeWidth={3} />
          ) : (
            <X className="size-3.5" strokeWidth={3} />
          )}
        </span>
      ) : state === 'idle' ? (
        <kbd
          aria-hidden
          className={cn(
            'hidden shrink-0 rounded-md border px-2 py-0.5 font-sans text-xs font-bold tabular-nums [@media(hover:hover)_and_(pointer:fine)]:inline-block',
            tall ? 'border-white/40 text-white/80' : 'border-border text-muted-foreground',
          )}
        >
          {index + 1}
        </kbd>
      ) : null}
    </button>
  );
}
