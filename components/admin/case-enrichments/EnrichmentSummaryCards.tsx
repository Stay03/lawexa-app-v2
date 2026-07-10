'use client';

import { Database, ListChecks, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
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
  value: number;
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
          <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard header: coverage progress bar + the four headline counts.
 * Progress = 1 − remaining/eligible (per the backend contract).
 */
export function EnrichmentSummaryCards({ summary, isLoading }: EnrichmentSummaryCardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  const { eligible_cases, remaining_cases, enriched_cases, runs, unmapped_outcomes } =
    summary;
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
            {eligible_cases.toLocaleString()} eligible cases enriched ·{' '}
            {remaining_cases.toLocaleString()} remaining
          </p>
        </CardContent>
      </Card>

      {/* Headline counts */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
