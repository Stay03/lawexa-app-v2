'use client';

import { Keyboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CaseArgumentsSummary } from '@/types/admin-case-arguments';

interface ReviewTopStripProps {
  summary: CaseArgumentsSummary | undefined;
  isLoading: boolean;
  onShowShortcuts: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="tabular-nums text-lg font-semibold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * The numbers, each saying what it counts.
 *
 * ── CASES AND ROWS ARE BOTH SHOWN, NEITHER IS NAKED ───────────────────────
 * "512 left" is ambiguous at midnight and the two readings differ by an order
 * of magnitude: 512 cases hold 4,964 arguments. A reviewer who has finished
 * forty cases should be able to see which number moved without working it out,
 * so both are on screen with their units in words.
 *
 * `reviewed` from the server is APPROVED ONLY — rejected rows are counted
 * separately and are not a subset of it — so "kept" and "thrown out" are two
 * columns rather than one with a footnote.
 */
export function ReviewTopStrip({
  summary,
  isLoading,
  onShowShortcuts,
}: ReviewTopStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
      {isLoading || !summary ? (
        <div className="flex flex-wrap items-center gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Stat
            label="cases to review"
            value={summary.cases_with_unreviewed.toLocaleString()}
          />
          <Stat
            label="arguments waiting"
            value={summary.unreviewed.toLocaleString()}
          />
          <Stat label="kept so far" value={summary.reviewed.toLocaleString()} />
          <Stat label="thrown out" value={summary.rejected.toLocaleString()} />
          <Stat
            label="decided today"
            value={(summary.reviewed_today + summary.rejected_today).toLocaleString()}
          />
        </div>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={onShowShortcuts}>
        <Keyboard className="mr-1 size-4" aria-hidden />
        Shortcuts
      </Button>
    </div>
  );
}
