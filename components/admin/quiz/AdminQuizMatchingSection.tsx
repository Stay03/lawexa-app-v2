'use client';

import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatPeriodWindow } from '@/lib/utils/quiz-format';
import { useAdminQuizMatchingHealth } from '@/lib/hooks/useAdminQuiz';
import type {
  AdminQuizMatchingHealth,
  AdminQuizPeriodParams,
} from '@/types/admin-quiz';

/** Format a possibly-null rate (no serves in period → "—"). */
function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate)}%`;
}

const TIERS: {
  key: keyof AdminQuizMatchingHealth['tier_breakdown'];
  label: string;
  color: string;
}[] = [
  { key: 'own', label: 'Own', color: '#64748b' },
  { key: 'same_topic_other', label: 'Same-topic (cross-user)', color: '#22c55e' },
  { key: 'widened_own', label: 'Widened (own)', color: '#3b82f6' },
  { key: 'widened_other', label: 'Widened (cross-user)', color: '#a855f7' },
  { key: 'recycled', label: 'Recycled', color: '#f97316' },
];

/** Matching-health: serve-tier stats + tier breakdown + all-time topic coverage. */
export function AdminQuizMatchingSection({
  params,
}: {
  params: AdminQuizPeriodParams;
}) {
  const query = useAdminQuizMatchingHealth(params);
  const health = query.data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matching health</CardTitle>
        {health && (
          <p className="text-xs text-muted-foreground">
            {formatPeriodWindow(health.period.start, health.period.end)} · coverage
            is all-time
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {query.isLoading ? (
          <MatchingSkeleton />
        ) : query.isError || !health ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load the matching-health monitor.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Stat
                label="Cross-user rate"
                value={formatRate(health.stat_cards.tier2_cross_user_rate)}
                emphasis
              />
              <Stat
                label="Total serves"
                value={health.stat_cards.total_serves.toLocaleString()}
              />
              <Stat label="Recycle rate" value={formatRate(health.stat_cards.recycle_rate)} />
              <Stat label="Own rate" value={formatRate(health.stat_cards.own_rate)} />
              <Stat
                label="Bank size"
                value={health.stat_cards.bank_size.toLocaleString()}
              />
              <Stat
                label="Topics"
                value={health.stat_cards.topic_coverage.toLocaleString()}
              />
              <Stat
                label="Cross-user topics"
                value={health.stat_cards.cross_user_topics.toLocaleString()}
              />
            </div>

            <TierBreakdown breakdown={health.tier_breakdown} />

            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium">Topic coverage</h3>
                <span className="text-xs text-muted-foreground">All-time</span>
              </div>
              <TopicCoverageTable rows={health.topic_coverage} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl p-3',
        emphasis ? 'bg-primary/5 ring-1 ring-primary/15' : 'bg-muted/50'
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums',
          emphasis && 'text-primary'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TierBreakdown({
  breakdown,
}: {
  breakdown: AdminQuizMatchingHealth['tier_breakdown'];
}) {
  const total = TIERS.reduce((sum, t) => sum + breakdown[t.key], 0);

  return (
    <div className="space-y-2.5">
      <h3 className="text-sm font-medium">Serve tiers</h3>
      {total === 0 ? (
        <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
          No serves in this period.
        </p>
      ) : (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            {TIERS.map((t) => {
              const width = (breakdown[t.key] / total) * 100;
              return width > 0 ? (
                <div
                  key={t.key}
                  style={{ width: `${width}%`, backgroundColor: t.color }}
                  aria-label={`${t.label}: ${breakdown[t.key]}`}
                />
              ) : null;
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {TIERS.map((t) => (
              <span key={t.key} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
                <span className="font-medium tabular-nums text-foreground">
                  {breakdown[t.key].toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TopicCoverageTable({
  rows,
}: {
  rows: AdminQuizMatchingHealth['topic_coverage'];
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        No topics in the bank yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Topic</TableHead>
            <TableHead className="text-right">Questions</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Contributors
            </TableHead>
            <TableHead className="text-right">Cross-user</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.topic_key}>
              <TableCell className="font-medium">{r.topic}</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                {r.questions.toLocaleString()}
              </TableCell>
              <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                {r.contributors.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {r.cross_user ? (
                  <CheckCircle2
                    className="ml-auto h-4 w-4 text-emerald-600 dark:text-emerald-400"
                    aria-label="Cross-user matching active"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground" aria-label="Single contributor">
                    —
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MatchingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
