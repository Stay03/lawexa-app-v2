'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { ObservabilityTable } from '../index';
import { MATCH_METHOD_LABEL } from './status';
import {
  cleanupDiffEntries,
  isCleanupPreviewRow,
  type CaseMaintenancePreviewRow,
  type CaseMaintenanceRunType,
  type CleanupPreviewRow,
} from '@/types/admin-case-maintenance-runs';

const COLUMNS = [
  { key: 'tick', label: <span className="sr-only">Choose</span>, className: 'w-[1%]' },
  { key: 'case', label: 'Case', className: 'w-[55%]' },
  { key: 'method', label: 'How it would be matched' },
];

/* The last column answers a different question per job, so it is LABELLED per
   job. A cleanup matches nothing — it rewrites our own formatting — and a
   header reading "How it would be matched" over a column saying "title,
   citation, slug" asks the reader to reconcile two things that do not go
   together. */
const COLUMN_LABEL: Record<CaseMaintenanceRunType, string> = {
  nwlr_refresh: 'How it would be matched',
  editorial_cleanup: 'What would change',
};

/**
 * The cases that qualify, with the tick boxes that choose them.
 *
 * ── THE MATCH COLUMN IS THE REASON THIS IS NOT JUST A LIST OF CASES ───────
 * Every row says how it would be tied to a document at the provider — by its
 * citation, by a part number with the page missing, or by title alone. That is
 * the one fact a reader cannot work out for themselves, and it is what tells
 * them a run will need their attention part way through: title-only rows stop
 * and wait for a person, the others do not.
 *
 * ── SELECT-ALL MEANS WHAT IS ON THIS PAGE ─────────────────────────────────
 * And it says so. Selecting a page and calling it "all" is how somebody starts
 * a run over 15 cases believing they started one over 1,811 — the reverse
 * mistake is worse, but both come from the same vague word. Running everything
 * that matches is a separate, deliberate choice made above this table.
 */
export function CaseMaintenancePreviewTable({
  rows,
  type,
  isLoading,
  selected,
  onToggle,
  onToggleAll,
}: {
  rows: CaseMaintenancePreviewRow[];
  type: CaseMaintenanceRunType;
  isLoading: boolean;
  selected: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onToggleAll: (ids: number[], select: boolean) => void;
}) {
  const pageIds = rows.map((row) => row.case.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  return (
    <ObservabilityTable
      columns={[
        {
          ...COLUMNS[0],
          label: (
            <Checkbox
              checked={allOnPage ? true : someOnPage ? 'indeterminate' : false}
              onCheckedChange={(next) => onToggleAll(pageIds, next === true)}
              aria-label={
                allOnPage
                  ? 'Unselect the cases on this page'
                  : 'Select the cases on this page'
              }
              disabled={pageIds.length === 0}
            />
          ),
        },
        COLUMNS[1],
        { ...COLUMNS[2], label: COLUMN_LABEL[type] },
      ]}
      isLoading={isLoading}
      isEmpty={rows.length === 0}
      emptyText="No cases match that selection"
    >
      {rows.map((row) => {
        const ticked = selected.has(row.case.id);
        return (
          <TableRow key={row.case.id} data-state={ticked ? 'selected' : undefined}>
            <TableCell>
              <Checkbox
                checked={ticked}
                onCheckedChange={() => onToggle(row.case.id)}
                aria-label={`Include ${row.case.title}`}
              />
            </TableCell>
            {/* max-w-0 with the declared column width, for the reason the items
                table records: without it the cell grows to the title and pushes
                the rest of the row out of view. */}
            <TableCell className="max-w-0">
              <div className="truncate font-medium" title={row.case.title}>
                {row.case.title}
              </div>
              {row.case.citation ? (
                <div className="truncate text-xs text-muted-foreground">
                  {row.case.citation}
                </div>
              ) : null}
            </TableCell>
            <TableCell className="max-w-0 text-sm text-muted-foreground">
              {isCleanupPreviewRow(row) ? (
                <CleanupOutcome row={row} />
              ) : (
                <>
                  {row.bucket ? MATCH_METHOD_LABEL[row.bucket] : '—'}
                  {/* The part and page the server parsed out of the citation.
                      "Part 613, no page" says why a case needs a search in a
                      way the phrase "part only" never will. */}
                  {typeof row.part === 'number' ? (
                    <div className="text-xs">
                      Part {row.part}
                      {typeof row.page === 'number' ? `, page ${row.page}` : ', no page'}
                    </div>
                  ) : null}
                </>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </ObservabilityTable>
  );
}

/**
 * What a cleanup would do to one case.
 *
 * ── MOST CASES ARE ALREADY FINE, AND THE ROW SHOULD SAY SO ────────────────
 * 6,544 of 11,612 would not be touched. A row that says nothing leaves the
 * reader to guess whether it is unchanged or whether we failed to work it out.
 *
 * ── AND WHERE IT WOULD CHANGE, IT SHOWS THE CHANGE ────────────────────────
 * The preview carries the actual before and after per field, which is the
 * difference between asking somebody to approve "a cleanup" and asking them to
 * approve a rewrite they can see. The fields are named on the row and the
 * first rewrite is shown under them; the rest are reachable in the title,
 * because five stacked diffs per row over 11,612 rows is not a table anybody
 * can read.
 */
function CleanupOutcome({ row }: { row: CleanupPreviewRow }) {
  const entries = cleanupDiffEntries(row);

  if (row.held_back) {
    return (
      <div className="text-amber-700 dark:text-amber-400">
        Held back
        <div className="truncate text-xs" title={row.held_back}>
          {row.held_back}
        </div>
      </div>
    );
  }

  if (!row.would_change) return <span>No change</span>;

  const [firstField, firstDiff] = entries[0] ?? [];
  return (
    <div className="space-y-0.5">
      <div className="truncate font-medium text-foreground">
        {row.flags.join(', ') || 'Would change'}
      </div>
      {firstField && firstDiff ? (
        <div
          className="truncate text-xs"
          title={entries
            .map(([field, d]) => [field, d.from ?? '—', d.to ?? '—'].join(' | '))
            .join(' · ')}
        >
          {firstDiff.to ?? '—'}
        </div>
      ) : null}
    </div>
  );
}
