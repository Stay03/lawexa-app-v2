'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChartColumn, RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useV2Session } from '@/v2/runtime/session-context';
import { SettingsState } from '@/v2/features/settings/SettingsState';
import { TabRow } from '@/v2/shell/TabRow';
import {
  DEFAULT_STATS_PERIOD,
  STATS_PERIODS,
  dayCount,
  longDate,
  shortDate,
  statsGrid,
  streakSpan,
  type StatsGrid,
  type StatsPeriod,
  type StatsTotals,
} from './model';
import { statsQueries } from './queries';
import { STATS_COLUMN, StatsFallback, StatsHeading } from './StatsFallback';

const PANEL_ID = 'stats-period-panel';

/**
 * StatsScreen — `/activity/stats`: the reader's own record in Lawexa (Stay,
 * 29 September 2026: "I also want a page like this"; the ask: streaks, a daily
 * grid, and a switch between 12, 6 and 3 months and 30 days).
 *
 * TWO PARTS, TOP DOWN. The streaks: current and longest, which cover the
 * whole history whatever the period says. Then the period: the switch, a grid
 * of active days, and the period's own counts. Every number is the server's
 * (`GET /me/activity`).
 *
 * Left out: the all-time totals (Stay, 20 October 2026: "remove them only keep
 * the two streak"), and the server's `top_tools` and `insights`.
 */
export function StatsScreen() {
  const { signedIn, role, userId: viewerId } = useV2Session();
  const hasAccount = signedIn && role !== 'guest';
  const [period, setPeriod] = useState<StatsPeriod>(DEFAULT_STATS_PERIOD);
  const stats = useQuery({ ...statsQueries.mine({ period, viewerId }), enabled: hasAccount });
  const days = stats.data?.days;
  const grid = useMemo(() => statsGrid(days ?? []), [days]);

  if (!hasAccount) {
    return (
      <div className={STATS_COLUMN}>
        <StatsHeading />
        <SettingsState icon={ChartColumn} title="Sign in to see your stats" description="Your stats are kept for your account." />
      </div>
    );
  }

  if (stats.isPending) return <StatsFallback />;

  if (stats.isError || !stats.data) {
    return (
      <div className={STATS_COLUMN}>
        <StatsHeading />
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your stats did not load"
          description="Check your connection and try again."
          action={
            <Button size="sm" variant="outline" disabled={stats.isFetching} onClick={() => void stats.refetch()}>
              <RotateCw aria-hidden className={cn('size-4', stats.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const data = stats.data;
  const periodLabel = STATS_PERIODS.find((entry) => entry.id === data.period)?.label ?? '';

  return (
    <div className={cn(STATS_COLUMN, 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200')}>
      <StatsHeading />

      <section aria-label="Streaks" className="grid grid-cols-2 gap-3">
        <StreakCard
          label="Current streak"
          value={dayCount(data.streak.current)}
          span={streakSpan(data.streak.current, data.streak.current_from)}
        />
        <StreakCard
          label="Longest streak"
          value={dayCount(data.streak.longest)}
          span={streakSpan(data.streak.longest, data.streak.longest_from, data.streak.longest_to)}
        />
      </section>

      <section aria-labelledby="stats-period" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="stats-period" className="text-[15px] font-semibold text-foreground">
            Active days
          </h2>
          <TabRow
            tabs={STATS_PERIODS}
            value={period}
            onChange={setPeriod}
            ariaLabel="Period"
            panelId={PANEL_ID}
            className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5"
            tabClassName={(selected) =>
              cn(
                'v2-interactive min-h-8 shrink-0 rounded-full px-3 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
                selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {(tab) => tab.label}
          </TabRow>
        </div>

        {/* The last period stays on screen, dimmed, while the next one loads. */}
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${PANEL_ID}-tab-${period}`}
          aria-busy={stats.isPlaceholderData || undefined}
          className={cn('transition-opacity duration-200 motion-reduce:transition-none', stats.isPlaceholderData && 'opacity-60')}
        >
          <p className="mb-2 text-xs text-muted-foreground tabular-nums">
            {dayCount(data.totals.active_days)} active · {longDate(data.from)} to {longDate(data.to)}
          </p>
          <ActiveDays grid={grid} label={`Active days over the last ${periodLabel}`} />

          <dl className="mt-6 flex flex-col divide-y divide-border/40 text-sm">
            <Row label="Chats started" value={data.totals.chats_started} />
            <Row label="Messages sent" value={data.totals.messages_sent} />
            <Row label="Cases read" value={data.totals.cases_read} />
            <Row label="Statutes read" value={data.totals.statutes_read} />
            <Row label="Notes read" value={data.totals.notes_read} />
            <Row label="Notes written" value={data.totals.notes_written} />
            <Row label="Quizzes" value={quizLine(data.totals)} />
          </dl>
        </div>
      </section>
    </div>
  );
}

function StreakCard({ label, value, span }: { label: string; value: string; span: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-card px-4 py-3 ring-1 ring-border/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      {/* Always a line, so the two cards keep one height. */}
      <p className="min-h-4 text-xs text-muted-foreground tabular-nums">{span}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground tabular-nums">{typeof value === 'number' ? value.toLocaleString('en-GB') : value}</dd>
    </div>
  );
}

/** "None yet", "3 of 4 finished", or "3 of 4 finished · 78% average". */
function quizLine(totals: StatsTotals): string {
  if (totals.quizzes_started === 0) return 'None yet';
  const finished = `${totals.quizzes_finished} of ${totals.quizzes_started} finished`;
  return totals.quiz_average_score === null ? finished : `${finished} · ${totals.quiz_average_score}% average`;
}

const LEVEL = ['bg-foreground/[0.07]', 'bg-primary/30', 'bg-primary/55', 'bg-primary/80', 'bg-primary'] as const;

/**
 * The period as week columns, Sunday at the top. A year is 53 columns of 12 px
 * (a 10 px square and a 2 px gap), 636 px, so it fits the column on a computer;
 * on a phone it scrolls sideways and opens on the latest weeks.
 */
function ActiveDays({ grid, label }: { grid: StatsGrid; label: string }) {
  return (
    <div
      className="overflow-x-auto overscroll-x-contain pb-1"
      ref={(node) => {
        if (node) node.scrollLeft = node.scrollWidth;
      }}
    >
      <div className="inline-flex min-w-full flex-col gap-1.5">
        <div className="flex gap-0.5" aria-hidden>
          {grid.weeks.map((_, index) => {
            const month = grid.months.find((entry) => entry.week === index);
            return (
              <span key={index} className="w-2.5 shrink-0 text-[10px] leading-none text-muted-foreground">
                {month ? <span className="whitespace-nowrap">{month.label}</span> : null}
              </span>
            );
          })}
        </div>
        <div className="flex gap-0.5" role="img" aria-label={label}>
          {grid.weeks.map((week, index) => (
            <div key={index} className="flex flex-col gap-0.5">
              {week.map((cell, row) =>
                cell ? (
                  <span
                    key={cell.date}
                    title={`${shortDate(cell.date)}: ${cell.count} ${cell.count === 1 ? 'action' : 'actions'}`}
                    className={cn('size-2.5 rounded-[2px]', LEVEL[cell.level])}
                  />
                ) : (
                  <span key={`pad-${row}`} className="size-2.5" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
