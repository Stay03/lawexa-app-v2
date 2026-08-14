'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { PROBLEM_HINTS } from './model';
import type {
  CaseProblemCount,
  CaseProblemKey,
} from '@/types/admin-case-data-review';

interface ProblemNavProps {
  problems: [CaseProblemKey, CaseProblemCount][];
  selected: CaseProblemKey | null;
  onSelect: (key: CaseProblemKey) => void;
  isLoading: boolean;
}

/**
 * The problems, in the server's own order, each with its total and how many of
 * those we cannot compute a correction for.
 *
 * THE WORD "CORRECTION" IS DOING PRECISE WORK HERE, AND AN EARLIER DRAFT OF
 * THIS SCREEN GOT IT WRONG. `blocked` describes one thing only: whether a
 * corrected TITLE AND CITATION can be computed for that case. It says nothing
 * about the problem itself going away. The first version said "2,888 can be
 * fixed" under "No full report", which reads as though 2,888 missing judgments
 * could be recovered by this screen. They cannot, and nothing here recovers
 * one. The numbers prove the distinction: every no-court case is blocked,
 * because a citation cannot be generated without a court, while most cases
 * missing their judgment text are not.
 *
 * The split still earns its place. Old branding is 3,179 with 9 blocked, so
 * nearly all of it has a correction waiting. Unidentified court is 681 with 681
 * blocked, so none of it does until someone names a court.
 */
export function ProblemNav({
  problems,
  selected,
  onSelect,
  isLoading,
}: ProblemNavProps) {
  if (isLoading) {
    return (
      <div className="grid gap-1.5" aria-busy>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[58px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Problem types" className="grid gap-1.5">
      {/* Said once, above the numbers it qualifies, because "correction" is a
          narrower word than it looks and the counts are meaningless without
          it. */}
      <p className="px-3 pb-1 text-xs text-muted-foreground">
        A correction is a corrected title and citation. It does not replace
        content the case is missing.
      </p>
      {problems.map(([key, problem]) => {
        const isSelected = key === selected;
        const allBlocked = problem.total > 0 && problem.blocked === problem.total;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-current={isSelected ? 'true' : undefined}
            title={PROBLEM_HINTS[key]}
            className={cn(
              'group w-full rounded-lg border px-3 py-2 text-left',
              'transition-colors duration-150 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isSelected
                ? 'border-primary/40 bg-primary/5'
                : 'border-transparent hover:bg-muted'
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  'min-w-0 truncate text-sm',
                  isSelected ? 'font-semibold text-foreground' : 'text-foreground/90'
                )}
              >
                {problem.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {problem.total.toLocaleString()}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {problem.blocked === 0 ? (
                'Correction ready for all'
              ) : allBlocked ? (
                <span className="text-destructive">No correction can be computed</span>
              ) : (
                <>
                  {(problem.total - problem.blocked).toLocaleString()} with a
                  correction
                  {', '}
                  {problem.blocked.toLocaleString()} without
                </>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
