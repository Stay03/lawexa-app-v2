'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { ObservabilityTable } from '../index';
import { MATCH_METHOD_LABEL } from './status';
import type { CaseMaintenancePreviewRow } from '@/types/admin-case-maintenance-runs';

const COLUMNS = [
  { key: 'tick', label: <span className="sr-only">Choose</span>, className: 'w-[1%]' },
  { key: 'case', label: 'Case', className: 'w-[55%]' },
  { key: 'method', label: 'How it would be matched' },
];

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
  isLoading,
  selected,
  onToggle,
  onToggleAll,
}: {
  rows: CaseMaintenancePreviewRow[];
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
        ...COLUMNS.slice(1),
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
            <TableCell className="text-sm text-muted-foreground">
              {row.bucket ? MATCH_METHOD_LABEL[row.bucket] : '—'}
              {/* The part and page the server parsed out of the citation. "Part
                  613, no page" explains why a case needs a search in a way the
                  phrase "part only" never will.
                  
                  `typeof === 'number'`, NOT `!== null`. On a cleanup preview
                  these fields are ABSENT rather than null, and `undefined !==
                  null` is true — so the first version printed "Part , page
                  undefined" on all 11,612 cleanup rows. Caught only by pointing
                  at production; every fixture I had written used null. */}
              {typeof row.part === 'number' ? (
                <div className="text-xs">
                  Part {row.part}
                  {typeof row.page === 'number' ? `, page ${row.page}` : ', no page'}
                </div>
              ) : null}
            </TableCell>
          </TableRow>
        );
      })}
    </ObservabilityTable>
  );
}
