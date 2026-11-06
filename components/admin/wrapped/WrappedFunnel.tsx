'use client';

import { cn } from '@/lib/utils';
import { percentText, type FunnelStep } from './wrapped-admin';

/**
 * One story's funnel, one row per step: the bar is the share of that story's
 * students, the right-hand numbers are the count, that share, and the share of
 * the step before (where the drop between two steps shows).
 */
export function WrappedFunnel({ steps, label }: { steps: FunnelStep[]; label: string }) {
  return (
    <ol className="space-y-1.5" aria-label={label}>
      {steps.map((step) => (
        <li
          key={step.key}
          className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
        >
          <span className={cn('truncate', step.key.startsWith('card-') && 'pl-3 text-muted-foreground')}>{step.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${step.ofHave ?? 0}%` }}
            />
          </span>
          <span className="flex items-baseline justify-end gap-3 tabular-nums">
            <span className="w-14 text-right font-medium">{step.count.toLocaleString()}</span>
            <span className="w-11 text-right text-muted-foreground">{percentText(step.ofHave)}</span>
            <span
              className="hidden w-16 text-right text-xs text-muted-foreground sm:inline"
              title="Of the step before"
            >
              {step.ofPrevious === null ? '' : `${percentText(step.ofPrevious)} of prev.`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
