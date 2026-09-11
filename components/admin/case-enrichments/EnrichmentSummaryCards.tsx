'use client';

import {
  AlertTriangle,
  CirclePause,
  Database,
  FileDiff,
  Hourglass,
  ListChecks,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CaseEnrichmentSummary } from '@/types/admin-case-enrichments';

interface EnrichmentSummaryCardsProps {
  summary?: CaseEnrichmentSummary;
  isLoading: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Database;
  label: string;
  /** Null when the API did not send the count: shown as a dash, never as 0. */
  value: number | null;
  hint?: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            tone === 'warning'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
              : 'bg-primary/10 text-primary'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {value === null ? '—' : value.toLocaleString()}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** A count the API sent, or null for anything else (absent, null, a string). */
const sentCount = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/**
 * Dashboard header: coverage progress bar + the headline counts.
 * Progress = 1 − remaining/eligible (per the backend contract).
 *
 * A partial case that already has principles is not in `remaining_cases`, so
 * the covered share includes it. The line says "have structures" rather than
 * "enriched" for that reason, and names the partial count beside it.
 *
 * THE PARTIAL COUNTS SHOW A DASH UNLESS THE API SENDS A NUMBER. The frontend
 * can deploy before the API that adds them, and a 0 would claim no case is
 * partial, stopped or changed when the API has simply not said. The page reads
 * the same fields the same way to decide which sweep toggles exist.
 *
 * TWO GROUPS OF CARDS, EACH SIZED FOR ITS COUNT. Coverage is three cards, three
 * across from lg. What to watch is four: Partial, then the two partial states
 * the sweep does not resume (Stopped, Report changed), then Unmapped outcomes.
 * Seven cards in one three-across grid leave one alone on a row, and four
 * across leaves too little room below 1536 px: measured on 11 Sep 2026, a card
 * at four across has 116 px of text room at 1280 and 156 px at 1440, while
 * "Missing parts · 14 partial runs" needs 156 px and "Unmapped outcomes" 138
 * px. So the watch group is two across until 2xl. Below lg both groups are two
 * across, as the cards were before.
 */
export function EnrichmentSummaryCards({ summary, isLoading }: EnrichmentSummaryCardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  const { eligible_cases, remaining_cases, enriched_cases, runs, unmapped_outcomes } =
    summary;
  const partialCases = sentCount(summary.partial_cases);
  const stoppedCases = sentCount(summary.partial_stopped_cases);
  const textChangedCases = sentCount(summary.partial_text_changed_cases);
  const partialRuns = runs.partial;
  const coverage =
    eligible_cases > 0
      ? Math.round(((eligible_cases - remaining_cases) / eligible_cases) * 100)
      : 0;
  const isRunning = runs.running > 0;

  return (
    <div className="space-y-4">
      {/* Coverage progress */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Structured-content coverage</p>
              {isRunning && (
                <span className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {runs.running} running
                </span>
              )}
            </div>
            <p className="text-sm font-semibold tabular-nums">{coverage}%</p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${coverage}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {(eligible_cases - remaining_cases).toLocaleString()} of{' '}
            {eligible_cases.toLocaleString()} eligible cases have structures
            {partialCases !== null &&
              partialCases > 0 &&
              ` · ${partialCases.toLocaleString()} partial`}{' '}
            · {remaining_cases.toLocaleString()} remaining
          </p>
        </CardContent>
      </Card>

      {/* Coverage counts */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          icon={Database}
          label="Eligible"
          value={eligible_cases}
          hint="Cases with a full report"
        />
        <StatCard
          icon={ListChecks}
          label="Remaining"
          value={remaining_cases}
          hint="Awaiting structures"
        />
        <StatCard
          icon={Sparkles}
          label="Enriched"
          value={enriched_cases}
          hint="≥1 completed run"
        />
      </div>

      {/* What to watch */}
      <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
        <StatCard
          icon={Hourglass}
          label="Partial"
          value={partialCases}
          hint={
            partialRuns === undefined
              ? 'Waiting on missing parts'
              : `Missing parts · ${partialRuns.toLocaleString()} partial run${partialRuns === 1 ? '' : 's'}`
          }
        />
        <StatCard
          icon={CirclePause}
          label="Stopped"
          value={stoppedCases}
          hint="Sweep no longer retries"
          tone={(stoppedCases ?? 0) > 0 ? 'warning' : 'default'}
        />
        {/* "Report changed after the partial run" needs about 191 px on one
            line; a card at four across from 1536 px has 180. The label already
            names the report. */}
        <StatCard
          icon={FileDiff}
          label="Report changed"
          value={textChangedCases}
          hint="Changed after the partial run"
          tone={(textChangedCases ?? 0) > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Unmapped outcomes"
          value={unmapped_outcomes}
          hint="Need enum extension"
          tone={unmapped_outcomes > 0 ? 'warning' : 'default'}
        />
      </div>
    </div>
  );
}
