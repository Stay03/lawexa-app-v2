'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  CalendarClock,
  Download,
  Gift,
  Loader2,
  UserRound,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  ObservabilityTable,
  SummaryStatCard,
  SummaryStatCardSkeleton,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import { currencySymbol, moneyLines } from '@/components/admin/ambassadors/money';
import { FinancialsFilterBar } from '@/components/admin/ambassadors/FinancialsFilterBar';
import {
  currenciesIn,
  facetOptions,
  filterRows,
  isFiltered,
  joinApplications,
  NO_FILTERS,
  sortRows,
  type FinancialsFilters,
  type SortColumn,
  type SortState,
} from '@/components/admin/ambassadors/financials';
import {
  downloadCsv,
  financialsCsv,
  localDay,
} from '@/components/admin/ambassadors/financials-csv';
import { adminAmbassadorsApi } from '@/lib/api/ambassadors';
import type { AmbassadorFinancialRow } from '@/types/ambassador';

/**
 * Ambassador financials — what every ambassador brought in.
 *
 * ── THE COLUMN THAT MUST NOT BE MISNAMED ───────────────────────────────────
 * `revenue` is WHAT THE REFERRED PEOPLE SPENT. It is not commission, not
 * earnings, and not owed: nobody has decided ambassadors are paid anything, and
 * a column header is exactly how a decision like that gets made by accident. It
 * is headed "Their referrals spent" for that reason, on screen and in the CSV.
 *
 * It is also per-currency and never added up. Lawexa is paid in naira and in
 * dollars, and until our audit found it the server was summing the two into one
 * number that was not money in any currency. See `./money.ts` — nothing on this
 * screen does arithmetic on an amount. The CSV gives every currency its own
 * column for the same reason, and sorting by money sorts inside ONE currency:
 * there is no order over naira and dollars together that is not an invented
 * exchange rate.
 *
 * ── THE FLAG IS A PROMPT, NOT AN ACCUSATION ────────────────────────────────
 * `unusual_activity` means more than 20 signups in a day. An ambassador demoing
 * to a lecture hall trips it exactly as somebody farming would, so it is drawn
 * as a quiet marker — no red, no "Flagged" filter, no sort key, and never a
 * default sort, because sorting a table by suspicion is an accusation with
 * extra steps. It opens the day-by-day record instead, which is the only thing
 * that can actually settle it.
 *
 * ── AND NOBODY IS FILTERED OUT ─────────────────────────────────────────────
 * Ambassadors who referred nobody appear with zeros. "Did nothing" and "not in
 * the list" are different answers, and only one of them is true. No filter is
 * on when the screen opens, and "no ambassador matches these filters" is worded
 * so it can never be read as "there are no ambassadors".
 *
 * ── EVERY CONTROL WORKS ON THE ARRAY THAT IS ALREADY HERE ──────────────────
 * `/admin/ambassadors/financials` takes NO parameters and answers with all 113
 * ambassadors and the totals in one response (measured 2026-09-09). There is no
 * page and no server-side search or sort to hand this off to, so the search
 * box, the three facets, the date window, the column sorts and the CSV all
 * narrow what is in memory, and none of them refetches.
 *
 * ── UNIVERSITY, LEVEL AND COUNTRY COME FROM A SECOND CALL ──────────────────
 * A financials row does not carry them; the APPLICATION does. They are joined
 * on `application_uuid` → application `uuid` by
 * `adminAmbassadorsApi.getAllApplications`, which walks
 * `/admin/ambassador-applications` a page at a time. Measured 2026-09-09: all
 * 113 rows match an application, and university, level and country are set on
 * every one of them — 4 countries, 5 levels, 90 universities. The table waits
 * for both calls so no row and no filter appears half-populated.
 *
 * ── THE DATE FILTER SAYS WHICH DATE IT MEANS ───────────────────────────────
 * A row carries `last_referral_at` and no per-day history, and the endpoint
 * takes no date parameter, so the only date question this screen can answer is
 * when somebody last referred anyone. The options say so: "Last referral in the
 * last 7 days", not "last 7 days". The counts and the money stay all-time
 * whatever is chosen, and the filter bar repeats that in words when a window is
 * on.
 */

const AMBASSADOR_COLUMN: ObservabilityColumn = { key: 'ambassador', label: 'Ambassador' };
const CODE_COLUMN: ObservabilityColumn = { key: 'code', label: 'Code' };
const ACTIVITY_COLUMN: ObservabilityColumn = { key: 'activity', label: 'Activity' };

function dayLabel(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />;
  return direction === 'asc' ? (
    <ArrowUp aria-hidden className="size-3.5 text-primary" />
  ) : (
    <ArrowDown aria-hidden className="size-3.5 text-primary" />
  );
}

/** A count column's header. Three clicks return the table to the order the
 *  server sent, which is the only way back to it. */
function SortHeader({
  label,
  sort,
  column,
  onSort,
}: {
  label: string;
  sort: SortState | null;
  column: SortColumn;
  onSort: (column: SortColumn) => void;
}) {
  const active = sort !== null && sort.column === column && sort.currency === null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-mr-3 h-8 gap-1.5 font-semibold"
      onClick={() => onSort(column)}
    >
      {label}
      <SortIcon active={active} direction={active ? sort.direction : 'desc'} />
    </Button>
  );
}

/**
 * The money column's header: the name, then one sort control per currency the
 * loaded rows actually contain.
 *
 * The currency is on the control because it is the ruler being used. Ranking
 * naira against dollars would need a rate and any rate here would be invented,
 * so each currency is its own order and a row holding nothing in that currency
 * sits at the bottom of it.
 */
function SpentHeader({
  currencies,
  sort,
  onSort,
}: {
  currencies: string[];
  sort: SortState | null;
  onSort: (column: SortColumn, currency: string) => void;
}) {
  return (
    <div className="-mr-1.5 flex items-center justify-end gap-1">
      <span>Their referrals spent</span>
      {currencies.map((code) => {
        const active = sort !== null && sort.column === 'revenue' && sort.currency === code;
        return (
          <Button
            key={code}
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 font-semibold"
            aria-label={`Sort by what referrals spent in ${code}`}
            title={`Sort by ${code}. Currencies are never added together, so each one sorts on its own.`}
            onClick={() => onSort('revenue', code)}
          >
            {currencySymbol(code).trim()}
            <SortIcon active={active} direction={active ? sort.direction : 'desc'} />
          </Button>
        );
      })}
    </div>
  );
}

/** The evidence behind the flag, on demand. */
function DailySignupsDialog({
  row,
  onOpenChange,
}: {
  row: AmbassadorFinancialRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ['ambassador-daily-signups', row?.user_uuid],
    queryFn: () => adminAmbassadorsApi.getDailySignups(row!.user_uuid, 30),
    enabled: row !== null,
  });

  const days = query.data?.data?.signups ?? [];

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row?.name}</DialogTitle>
          <DialogDescription>
            Signups by day, newest first. Only days with signups are listed.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
            Loading
          </div>
        ) : days.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No signups in the last 30 days.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {days.map((day) => (
              <li
                key={day.date}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-muted/40"
              >
                <span>{dayLabel(day.date)}</span>
                <span className="tabular-nums">
                  {day.signups === 1 ? '1 person' : `${day.signups} people`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AmbassadorFinancialsPage() {
  const [evidenceFor, setEvidenceFor] = useState<AmbassadorFinancialRow | null>(null);
  const [filters, setFilters] = useState<FinancialsFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortState | null>(null);

  // The clock, read ONCE as the screen opens. React Compiler rejects a clock
  // read during render and is right to: a cutoff that moves every frame makes
  // the memo below impossible to reuse. A 7-day line does not move enough
  // during one sitting to put a row on the other side of it.
  const [openedAt] = useState(() => Date.now());

  const query = useQuery({
    queryKey: ['ambassador-financials'],
    queryFn: () => adminAmbassadorsApi.getFinancials(),
  });

  // Second call, and it has to be: the financials row carries no university,
  // level or country, and the financials endpoint takes no parameters that
  // could add them.
  const profiles = useQuery({
    queryKey: ['ambassador-application-profiles'],
    queryFn: () => adminAmbassadorsApi.getAllApplications(),
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(() => query.data?.data?.ambassadors ?? [], [query.data]);
  const totals = query.data?.data?.totals;
  const totalRevenue = totals ? moneyLines(totals.revenue) : [];

  const joined = useMemo(
    () => joinApplications(rows, profiles.data ?? []),
    [rows, profiles.data]
  );
  const currencies = useMemo(() => currenciesIn(joined), [joined]);
  const visible = useMemo(
    () => sortRows(filterRows(joined, filters, openedAt), sort),
    [joined, filters, openedAt, sort]
  );
  const facets = useMemo(
    () => ({
      university: facetOptions(joined, filters, 'university', openedAt),
      level: facetOptions(joined, filters, 'level', openedAt),
      country: facetOptions(joined, filters, 'country', openedAt),
    }),
    [joined, filters, openedAt]
  );

  const updateFilters = useCallback((patch: Partial<FinancialsFilters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
  }, []);

  // Down first, because the question is almost always "who brought the most".
  // A third click drops the sort, which is the only way back to the order the
  // server sent.
  const toggleSort = useCallback((column: SortColumn, currency: string | null = null) => {
    setSort((previous) => {
      if (previous === null || previous.column !== column || previous.currency !== currency) {
        return { column, currency, direction: 'desc' };
      }
      return previous.direction === 'desc'
        ? { column, currency, direction: 'asc' }
        : null;
    });
  }, []);

  const handleExport = useCallback(() => {
    downloadCsv(
      `ambassador-financials-${localDay(new Date())}.csv`,
      financialsCsv(visible, currencies)
    );
  }, [visible, currencies]);

  const columns = useMemo<ObservabilityColumn[]>(
    () => [
      AMBASSADOR_COLUMN,
      CODE_COLUMN,
      {
        key: 'signed-up',
        label: (
          <SortHeader label="Signed up" sort={sort} column="referred_count" onSort={toggleSort} />
        ),
        className: 'text-right',
      },
      {
        key: 'paid',
        label: <SortHeader label="Ever paid" sort={sort} column="paid_count" onSort={toggleSort} />,
        className: 'text-right',
      },
      {
        key: 'spent',
        label: <SpentHeader currencies={currencies} sort={sort} onSort={toggleSort} />,
        className: 'text-right',
      },
      {
        key: 'gifted',
        label: (
          <SortHeader
            label="Free messages given"
            sort={sort}
            column="gifted_messages"
            onSort={toggleSort}
          />
        ),
        className: 'text-right',
      },
      ACTIVITY_COLUMN,
    ],
    [currencies, sort, toggleSort]
  );

  // Both calls, because a row with no university and a filter with no options
  // are the same half-loaded screen. Skeletons cover it rather than a pop-in.
  const isLoading = query.isPending || profiles.isPending;
  const filtering = isFiltered(filters);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {query.isPending || !totals ? (
            <>
              <SummaryStatCardSkeleton />
              <SummaryStatCardSkeleton />
              <SummaryStatCardSkeleton />
              <SummaryStatCardSkeleton />
            </>
          ) : (
            <>
              <SummaryStatCard
                icon={UserRound}
                label="Ambassadors"
                value={totals.ambassadors}
              />
              <SummaryStatCard
                icon={Users}
                label="Signed up"
                value={totals.referred_count}
                hint="Made an account"
              />
              <SummaryStatCard
                icon={BadgeCheck}
                label="Ever paid"
                value={totals.paid_count}
              />
              {/* Every currency on its own line. Never one figure. */}
              <SummaryStatCard
                icon={Gift}
                label="Free messages given"
                value={totals.gifted_messages}
                hint={
                  totalRevenue.length > 0
                    ? `Referrals spent ${totalRevenue.join(' · ')}`
                    : 'Referrals have spent nothing yet'
                }
              />
            </>
          )}
        </div>
        {/* The totals come from the server and count everybody. Saying so is
            cheaper than the alternative reading, which is that a filter is
            broken. */}
        {filtering && (
          <p className="text-xs text-muted-foreground">
            These four count every ambassador. The filters below apply to the table.
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Ambassadors</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={isLoading || visible.length === 0}
          >
            <Download aria-hidden className="size-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <FinancialsFilterBar
            filters={filters}
            onChange={updateFilters}
            facets={facets}
            shown={visible.length}
            total={joined.length}
            disabled={isLoading}
            profilesFailed={profiles.isError}
          />

          <ObservabilityTable
            columns={columns}
            isLoading={isLoading}
            isEmpty={visible.length === 0}
            emptyText={
              joined.length === 0
                ? 'No approved ambassadors yet'
                : 'No ambassador matches these filters'
            }
          >
            {visible.map((row) => {
              const spent = moneyLines(row.revenue);
              const profile = [row.university, row.level, row.country]
                .filter(Boolean)
                .join(' · ');
              return (
                <TableRow key={row.user_uuid}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.email}
                      </p>
                      {/* The three things the filters and the search work on,
                          shown so a match is never a mystery. */}
                      {profile.length > 0 && (
                        <p className="truncate text-xs text-muted-foreground">
                          {profile}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.code ? (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {row.code}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not chosen
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.referred_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.paid_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {spent.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        {spent.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.gifted_messages}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {row.last_referral_at
                          ? `Last ${dayLabel(row.last_referral_at)}`
                          : 'None yet'}
                      </span>
                      {/* QUIET, AND IT OPENS THE EVIDENCE. Not red, not a badge
                          that says "suspicious" — the flag cannot tell a lecture
                          hall from a farm, so the only useful thing it can do is
                          show the days and let a person decide. */}
                      {row.unusual_activity && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                          onClick={() => setEvidenceFor(row)}
                        >
                          <CalendarClock aria-hidden className="size-3.5" />
                          {row.busiest_day.signups} in a day
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </ObservabilityTable>
        </CardContent>
      </Card>

      <DailySignupsDialog
        row={evidenceFor}
        onOpenChange={(open) => {
          if (!open) setEvidenceFor(null);
        }}
      />
    </div>
  );
}
