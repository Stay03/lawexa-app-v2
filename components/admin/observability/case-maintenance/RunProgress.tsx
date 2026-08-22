'use client';

import { cn } from '@/lib/utils';
import type { CaseMaintenanceRun } from '@/types/admin-case-maintenance-runs';

/**
 * How far a run has got, and — separately — how much it actually changed.
 *
 * ── THE TWO NUMBERS ARE NOT THE SAME AND THAT IS THE POINT ────────────────
 * `completed` counts cases we LOOKED AT. `changed_count` counts cases we
 * ALTERED. A cleanup over the whole corpus finishes thousands of items that
 * change nothing, because most cases are already correct; an NWLR run does the
 * same whenever a case was already refreshed or the evidence disagreed.
 *
 * So a bar showing only completion would fill to the end and tell the reader
 * 11,609 cases were rewritten when forty were. Both numbers are drawn, and the
 * changed one is given the sentence rather than being left to inference.
 *
 * @backendclaude raised this before it could bite. It is the kind of mistake
 * that survives review because every number on screen is true.
 */
export function RunProgress({
  run,
  className,
}: {
  run: CaseMaintenanceRun;
  className?: string;
}) {
  const total = run.total_items || 0;
  const p = run.progress;

  /* Everything that will not be looked at again. Anything else is still ahead
     of the run, so a bar drawn from `completed` alone would sit still while a
     run worked through failures. */
  const settled =
    p.completed + p.failed + p.skipped + p.cancelled + p.conflict + p.no_match;
  const pct = total > 0 ? Math.min(100, Math.round((settled / total) * 100)) : 0;
  const changedPct = total > 0 ? Math.min(100, Math.round((run.changed_count / total) * 100)) : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${settled} of ${total} cases handled, ${run.changed_count} changed`}
      >
        {/* Two lengths in one track: how far it has got, and how much of that
            actually changed anything. The changed part is drawn ON TOP in the
            solid colour, so the eye reads the smaller true number first. */}
        <div className="relative h-full w-full">
          <div
            className="absolute inset-y-0 left-0 bg-primary/25 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${changedPct}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {run.changed_count.toLocaleString()} changed
        </span>
        {' · '}
        {settled.toLocaleString()} of {total.toLocaleString()} handled
        {p.failed > 0 ? (
          <>
            {' · '}
            <span className="font-medium text-destructive">
              {p.failed.toLocaleString()} failed
            </span>
          </>
        ) : null}
        {p.awaiting_confirmation > 0 ? (
          <>
            {' · '}
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {p.awaiting_confirmation.toLocaleString()} need a decision
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
