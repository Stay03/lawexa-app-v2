'use client';

import { useRef } from 'react';

import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { setDesignMode, useDesignMode, type DesignMode } from './design-mode';

/**
 * DesignSwitch — the compact A|B segmented control that lets the owner flip the
 * home between the two Wave-2 candidate designs (deliverable #6). It writes the
 * shared `design-mode` store, so the home surface re-renders in lockstep.
 *
 * A11y: this is a single-select of mutually-exclusive options, so it's a WAI-ARIA
 * radiogroup (not toggle buttons) — `role="radiogroup"` with `role="radio"`
 * children, one roving tab stop (only the checked option is tabbable), and
 * Left/Right/Up/Down arrow keys move + select with wrap-around, exactly as the
 * radio-group authoring pattern prescribes. A tooltip explains what it does; it
 * fires on hover and on keyboard focus (focus bubbles to the group trigger).
 */

const OPTIONS: readonly { value: DesignMode; label: string; name: string }[] = [
  { value: 'a', label: 'A', name: 'Design A' },
  { value: 'b', label: 'B', name: 'Design B' },
];

export function DesignSwitch() {
  const mode = useDesignMode();
  const buttonRefs = useRef<Partial<Record<DesignMode, HTMLButtonElement>>>({});

  const move = (direction: -1 | 1) => {
    const index = OPTIONS.findIndex((option) => option.value === mode);
    const next = OPTIONS[(index + direction + OPTIONS.length) % OPTIONS.length];
    setDesignMode(next.value);
    buttonRefs.current[next.value]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="radiogroup"
          aria-label="Home design preview"
          onKeyDown={handleKeyDown}
          className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5"
        >
          {OPTIONS.map((option) => {
            const checked = option.value === mode;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  buttonRefs.current[option.value] = element ?? undefined;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={option.name}
                tabIndex={checked ? 0 : -1}
                onClick={() => setDesignMode(option.value)}
                className={cn(
                  'flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  checked
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </TooltipTrigger>
      <TooltipContent>Preview: switch home design A / B (dev only)</TooltipContent>
    </Tooltip>
  );
}
