'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { ObservabilityTable, ErrorCell, StatusBadge } from '../index';
import { itemStatusMeta, matchMethodLabel } from './status';
import {
  caseMaintenanceDetail,
  type CaseMaintenanceItem,
  type CaseMaintenanceItemDetail,
  type CaseMaintenanceReference,
} from '@/types/admin-case-maintenance-runs';

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
                {[item.case.citation, item.match_method ? matchMethodLabel(item.match_method) : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
            </TableCell>

            <TableCell>
              <StatusBadge meta={itemStatusMeta(item.status)} />
            </TableCell>

            <TableCell className="max-w-0 text-sm">
              {/* The error and the evidence are drawn TOGETHER, not as
                  alternatives — see `ItemDetail`. */}
              <ItemDetail
                detail={caseMaintenanceDetail(item.detail)}
                error={item.error}
                statusCode={item.status_code}
              />
            </TableCell>

            <TableCell>
              {awaiting && onDecide ? (
                <div className="flex items-center justify-end gap-2">
                  {/* NOTHING WAS FOUND, SO THERE IS NOTHING TO ACCEPT.
                      A name search that matched no document parks the item all
                      the same — somebody still has to clear it — but there is
                      no candidate behind it. Offering "Yes, use it" here asks a
                      reviewer to accept a thing that does not exist: the server
                      refuses with "the item has no stored candidate", the row
                      does not move, and the screen looks broken. The owner hit
                      exactly this and asked, reasonably, "use what?". */}
                  {item.provider_case_id === null ? (
                    <span className="mr-1 text-xs text-muted-foreground">
                      Nothing found to use
                    </span>
                  ) : null}
                  {/* Safe first, and plain. Refusing writes nothing. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onDecide(item.id, 'reject')}
                  >
                    {item.provider_case_id === null ? 'Clear it' : 'Not this one'}
                  </Button>
                  {/* The one that writes a judgment into a case. Only offered
                      when there IS a judgment to write. */}
                  {item.provider_case_id !== null ? (
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
                  ) : null}
                </div>
              ) : null}
            </TableCell>
          </TableRow>
        );
      })}
    </ObservabilityTable>
  );
}

/**
 * What the server found, in words a person can judge.
 *
 * ── IT IS AN OBJECT, AND RENDERING IT DIRECTLY WHITE-SCREENED THE PAGE ────
 * `detail` was documented as free text and is not: it carries `changed`, an
 * `evidence` record, a `reference`, `case_slug` and `boundary_confidence`.
 * Printed straight into the row, React threw error #31 and the owner lost the
 * whole run page mid-run. So nothing here renders an unknown value directly.
 *
 * ── THE ERROR AND THE EVIDENCE ARE NOT ALTERNATIVES ───────────────────────
 * This cell used to show one OR the other, and a refused row is exactly the
 * row that has both. Every conflict in the owner's runs reads "the fetched
 * document does not agree" while its own evidence says the citation matched
 * and the keys are identical — the disagreement is `v` against `v.` and a year
 * taken from the wrong line. Showing only the sentence hides the one thing
 * that would tell him the refusal is wrong.
 *
 * ── AND WHEN THERE IS NO EVIDENCE, THERE IS STILL A REASON ────────────────
 * A case that never reached the provider carries a `reference` instead: what
 * we read out of our own citation. "The citation names NWLR but carries no
 * part or page" and "we asked for Part 60, page 196 and got a 404" are
 * different problems with different owners, and the error sentence alone does
 * not separate them.
 */
function ItemDetail({
  detail,
  error,
  statusCode,
}: {
  detail: CaseMaintenanceItemDetail | null;
  error: string | null;
  statusCode: number | null;
}) {
  const evidence = detail?.evidence;
  const reference = detail?.reference;

  if (!error && !evidence) {
    if (!detail) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="text-muted-foreground">
        {detail.changed ? 'Replaced from NWLR' : 'Nothing changed'}
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      {error ? <ErrorCell error={error} /> : null}
      {/* The status code is sent on every failure precisely so a person can
          tell a provider outage from a case we simply could not find. */}
      {statusCode !== null ? (
        <span className="block text-xs text-muted-foreground">HTTP {statusCode}</span>
      ) : null}
      {evidence ? <Comparison evidence={evidence} /> : null}
      {!evidence && reference ? <ReferenceLine reference={reference} /> : null}
    </div>
  );
}

/**
 * Which parts of our record and the fetched document agreed.
 *
 * That is the only question that matters on a conflict. A case whose citation
 * matched but whose titles did not is precisely the one a person should rule
 * on — "Abacha v Fawehinmi" against "Abacha v. Fawehinmi" is the same case; a
 * different name entirely is not. So the three comparisons are named plainly,
 * and the two titles are put side by side underneath, because that is the
 * comparison being made.
 */
function Comparison({ evidence }: { evidence: NonNullable<CaseMaintenanceItemDetail['evidence']> }) {
  const agreed: string[] = [];
  const differed: string[] = [];
  const note = (label: string, ok: boolean | undefined) => {
    if (ok === true) agreed.push(label);
    else if (ok === false) differed.push(label);
  };
  note('citation', evidence.citation_match);
  note('year', evidence.year_match);
  note('title', evidence.title_match);

  return (
    <>
      <div className="truncate">
        {agreed.length > 0 ? (
          <span className="text-emerald-700 dark:text-emerald-400">
            {agreed.join(' and ')} agree
          </span>
        ) : null}
        {agreed.length > 0 && differed.length > 0 ? ', ' : null}
        {differed.length > 0 ? (
          <span className="text-amber-700 dark:text-amber-400">
            {differed.join(' and ')} differ
          </span>
        ) : null}
      </div>
      {/* The two titles, which is the comparison a person is actually making. */}
      {evidence.document_title ? (
        <div
          className="truncate text-xs text-muted-foreground"
          title={`Ours: ${evidence.our_title ?? '—'} | Theirs: ${evidence.document_title}`}
        >
          Theirs: {evidence.document_title}
        </div>
      ) : null}
    </>
  );
}

/** What we read out of our own citation, for a case that never got matched. */
function ReferenceLine({ reference }: { reference: CaseMaintenanceReference }) {
  if (typeof reference.part === 'number') {
    return (
      <span className="block text-xs text-muted-foreground">
        Asked for Part {reference.part}
        {typeof reference.page === 'number' ? `, page ${reference.page}` : ', no page'}
      </span>
    );
  }
  return (
    <span className="block text-xs text-muted-foreground">
      {reference.mentions_nwlr
        ? 'The citation names NWLR but carries no part or page'
        : 'No NWLR citation to look up'}
    </span>
  );
}
