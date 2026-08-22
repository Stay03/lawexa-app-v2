'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { ObservabilityTable, ErrorCell, StatusBadge } from '../index';
import { MATCH_METHOD_LABEL, itemStatusMeta } from './status';
import type { CaseMaintenanceItem } from '@/types/admin-case-maintenance-runs';

/* FOUR COLUMNS, NOT FIVE, AND THE WIDTHS ARE DECLARED.
   Filmed at 1280 with real-length case titles, the five-column version pushed
   the actions column off the side of the table: both decision buttons were in
   the DOM — which is all an assertion for them proves — and neither could be
   seen or pressed. The long titles also ran under the status badge.
   "Matched by" was the column to lose: for a row awaiting a decision it always
   reads "Matched by title only", which is the only reason such a row exists,
   so it was spending a column to repeat the status. It moves under the title
   for the rows where it varies. */
const COLUMNS = [
  { key: 'case', label: 'Case', className: 'w-[38%]' },
  { key: 'status', label: 'Status', className: 'w-[14%]' },
  { key: 'detail', label: 'What happened', className: 'w-[30%]' },
  { key: 'act', label: <span className="sr-only">Decide</span>, className: 'w-[18%] text-right' },
];

/**
 * Every case inside a run, and the one place a person decides something.
 *
 * ── THE CONFIRM STEP, AND WHY IT IS SHAPED THIS WAY ───────────────────────
 * 126 of the NWLR cases can only be tied to a document by their title. A wrong
 * match writes ANOTHER CASE'S JUDGMENT into ours and cannot be undone — the old
 * report is replaced and only a side table holds the previous text. So those
 * items stop at `awaiting_confirmation` and nothing is written until somebody
 * chooses.
 *
 * Which means the two buttons are not equals and must not look like it:
 *
 *  - "Not this one" is the SAFE choice and is the plain one. It writes nothing.
 *  - "Yes, use it" is the one that writes, so it carries the weight, and it is
 *    the one that has to be aimed at rather than fallen onto.
 *
 * The candidate itself is printed in the row before either button, because a
 * person cannot judge a match they cannot see, and a screen that asks for a
 * decision without showing the evidence is asking for a rubber stamp.
 */
export function CaseMaintenanceItemsTable({
  items,
  isLoading,
  onDecide,
  decidingId,
}: {
  items: CaseMaintenanceItem[];
  isLoading: boolean;
  /** `null` when the run cannot be decided on — finished, cancelled, or busy. */
  onDecide: ((itemId: number, decision: 'confirm' | 'reject') => void) | null;
  /** The row currently being written, so both its buttons can go quiet. */
  decidingId: number | null;
}) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={items.length === 0}
      emptyText="No cases in this run yet"
    >
      {items.map((item) => {
        const awaiting = item.status === 'awaiting_confirmation';
        const busy = decidingId === item.id;
        return (
          <TableRow key={item.id}>
            {/* `max-w-0` with a declared column width is what actually makes a
                table cell truncate: without it the cell grows to its content and
                pushes everything after it out of view. */}
            <TableCell className="max-w-0">
              <Link
                href={`/cases/${item.case.slug}`}
                target="_blank"
                rel="noreferrer"
                title={item.case.title}
                className="block truncate font-medium underline-offset-4 hover:underline"
              >
                {item.case.title}
              </Link>
              <div className="truncate text-xs text-muted-foreground">
                {[item.case.citation, item.match_method ? MATCH_METHOD_LABEL[item.match_method] : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
            </TableCell>

            <TableCell>
              <StatusBadge meta={itemStatusMeta(item.status)} />
            </TableCell>

            <TableCell className="max-w-0 text-sm">
              {item.error ? (
                <div className="space-y-0.5">
                  <ErrorCell error={item.error} />
                  {/* The shared cell carries the message only. The status code
                      is sent on every failure precisely so a person can tell a
                      provider outage from a case we simply could not find, so
                      it is drawn rather than dropped. */}
                  {item.status_code !== null ? (
                    <span className="block text-xs text-muted-foreground">
                      HTTP {item.status_code}
                    </span>
                  ) : null}
                </div>
              ) : (
                /* WRAPPED TO TWO LINES, NOT TRUNCATED TO ONE. This is the
                   evidence a person judges the match on, and the judgment is
                   permanent. Truncating it to "NWLR offers \"Savannah Bank v..."
                   makes hovering a precondition for deciding safely, which is
                   how a screen ends up collecting rubber stamps. Two lines fits
                   the candidate title and citation, which is the whole of it. */
                <span className="line-clamp-2 text-muted-foreground">
                  {item.detail ?? '—'}
                </span>
              )}
            </TableCell>

            <TableCell>
              {awaiting && onDecide ? (
                <div className="flex items-center justify-end gap-2">
                  {/* Safe first, and plain. Refusing writes nothing. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onDecide(item.id, 'reject')}
                  >
                    Not this one
                  </Button>
                  {/* The one that writes a judgment into a case. */}
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onDecide(item.id, 'confirm')}
                  >
                    {busy ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Yes, use it
                  </Button>
                </div>
              ) : null}
            </TableCell>
          </TableRow>
        );
      })}
    </ObservabilityTable>
  );
}
