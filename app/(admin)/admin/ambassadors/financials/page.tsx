'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  CalendarClock,
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
import { moneyLines } from '@/components/admin/ambassadors/money';
import { adminAmbassadorsApi } from '@/lib/api/ambassadors';
import type { AmbassadorFinancialRow } from '@/types/ambassador';

/**
 * Ambassador financials — what every ambassador brought in.
 *
 * ── THE COLUMN THAT MUST NOT BE MISNAMED ───────────────────────────────────
 * `revenue` is WHAT THE REFERRED PEOPLE SPENT. It is not commission, not
 * earnings, and not owed: nobody has decided ambassadors are paid anything, and
 * a column header is exactly how a decision like that gets made by accident. It
 * is headed "Their referrals spent" for that reason.
 *
 * It is also per-currency and never added up. Lawexa is paid in naira and in
 * dollars, and until our audit found it the server was summing the two into one
 * number that was not money in any currency. See `./money.ts` — nothing on this
 * screen does arithmetic on an amount.
 *
 * ── THE FLAG IS A PROMPT, NOT AN ACCUSATION ────────────────────────────────
 * `unusual_activity` means more than 20 signups in a day. An ambassador demoing
 * to a lecture hall trips it exactly as somebody farming would, so it is drawn
 * as a quiet marker — no red, no "Flagged" filter, and never a default sort,
 * because sorting a table by suspicion is an accusation with extra steps. It
 * opens the day-by-day record instead, which is the only thing that can
 * actually settle it.
 *
 * ── AND NOBODY IS FILTERED OUT ─────────────────────────────────────────────
 * Ambassadors who referred nobody appear with zeros. "Did nothing" and "not in
 * the list" are different answers, and only one of them is true.
 */

const COLUMNS: ObservabilityColumn[] = [
  { key: 'ambassador', label: 'Ambassador' },
  { key: 'code', label: 'Code' },
  { key: 'signed-up', label: 'Signed up', className: 'text-right' },
  { key: 'paid', label: 'Ever paid', className: 'text-right' },
  { key: 'spent', label: 'Their referrals spent', className: 'text-right' },
  { key: 'gifted', label: 'Free messages given', className: 'text-right' },
  { key: 'activity', label: 'Activity' },
];

function dayLabel(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
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

  const query = useQuery({
    queryKey: ['ambassador-financials'],
    queryFn: () => adminAmbassadorsApi.getFinancials(),
  });

  const rows = useMemo(() => query.data?.data?.ambassadors ?? [], [query.data]);
  const totals = query.data?.data?.totals;
  const totalRevenue = totals ? moneyLines(totals.revenue) : [];

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Ambassadors</CardTitle>
        </CardHeader>
        <CardContent>
          <ObservabilityTable
            columns={COLUMNS}
            isLoading={query.isPending}
            isEmpty={rows.length === 0}
            emptyText="No approved ambassadors yet"
          >
            {rows.map((row) => {
              const spent = moneyLines(row.revenue);
              return (
                <TableRow key={row.user_uuid}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.email}
                      </p>
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
