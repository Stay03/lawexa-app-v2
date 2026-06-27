'use client';

import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizOptionProps {
  label: string;
  selected: boolean;
  /** This option is the one currently being submitted. */
  pending: boolean;
  /** Whole group is locked (a submit is in flight). */
  disabled: boolean;
  index: number;
  onSelect: () => void;
}

/**
 * A single selectable answer. Echoes the OnboardingCard look: rounded-2xl card,
 * hover lift, primary ring when chosen, staggered entrance. Tapping it submits
 * (auto-advance) — the parent handles the actual answer call.
 */
export function QuizOption({
  label,
  selected,
  pending,
  disabled,
  index,
  onSelect,
}: QuizOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-all duration-200',
        'hover:border-primary/50 hover:bg-accent/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        'disabled:pointer-events-none',
        'animate-in fade-in slide-in-from-bottom-3 motion-reduce:animate-none',
        selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border',
        disabled && !selected && 'opacity-60'
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/30 text-transparent'
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}
