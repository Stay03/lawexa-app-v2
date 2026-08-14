'use client';

import { SearchX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CaseReviewCard } from './CaseReviewCard';
import type { CaseProblemKey, CaseReviewRow } from '@/types/admin-case-data-review';

interface CaseReviewListProps {
  rows: CaseReviewRow[];
  isLoading: boolean;
  activeProblem: CaseProblemKey | null;
  /** What the empty state should say, which depends on the filter that emptied it. */
  emptyMessage: string;
}

export function CaseReviewList({
  rows,
  isLoading,
  activeProblem,
  emptyMessage,
}: CaseReviewListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3" aria-busy>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[188px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
        <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  /* Said once, and only when it applies to something on this page. The reason
     sits on each row because it varies; this sentence does not vary, so
     repeating it down a list of fifteen would be noise. */
  const hasBlocked = rows.some((row) => row.fix.state === 'blocked');

  return (
    <div className="grid gap-3">
      {hasBlocked && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
          Where no correction can be computed, none is offered. A generated
          citation would be built from the case itself, so a case with no
          identified court would produce something that reads like a citation
          and identifies nothing.
        </p>
      )}
      <div className="grid gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        {rows.map((row) => (
          <CaseReviewCard key={row.id} row={row} activeProblem={activeProblem} />
        ))}
      </div>
    </div>
  );
}
