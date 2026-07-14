'use client';

import { cn } from '@/lib/utils';

interface ListProgressProps {
  checked: number;
  total: number;
  /** Show the "checked/total" count beside the bar. Defaults to true. */
  showCount?: boolean;
  className?: string;
}

/**
 * A slim completion bar for a task list: a rounded track with a filled portion,
 * optionally trailed by a "checked/total" count. Reused by the list card and the
 * detail header. Fully complete lists tint the fill to the emerald "done" hue.
 *
 * There is no `progress` primitive in this repo, so this is a plain two-`div`
 * bar sized by an inline width — the one place an inline style is warranted.
 */
export function ListProgress({
  checked,
  total,
  showCount = true,
  className,
}: ListProgressProps) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, checked / total)) : 0;
  const isComplete = total > 0 && checked >= total;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={checked}
        aria-label={`${checked} of ${total} items complete`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out',
            isComplete ? 'bg-emerald-500' : 'bg-primary'
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {showCount && (
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {checked}/{total}
        </span>
      )}
    </div>
  );
}
