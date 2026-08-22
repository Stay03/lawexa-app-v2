'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { ObservabilityTable } from '../index';
import { MATCH_METHOD_LABEL } from './status';
import type { CaseMaintenancePreviewRow } from '@/types/admin-case-maintenance-runs';

const COLUMNS = [
  { key: 'tick', label: <span className="sr-only">Choose</span>, className: 'w-[1%]' },
  { key: 'case', label: 'Case' },
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
  const pageIds = rows.map((row) => row.id);
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
        const ticked = selected.has(row.id);
        return (
          <TableRow key={row.id} data-state={ticked ? 'selected' : undefined}>
            <TableCell>
              <Checkbox
                checked={ticked}
                onCheckedChange={() => onToggle(row.id)}
                aria-label={`Include ${row.title}`}
              />
            </TableCell>
            <TableCell className="max-w-[26rem]">
              <div className="font-medium">{row.title}</div>
              {row.citation ? (
                <div className="text-xs text-muted-foreground">{row.citation}</div>
              ) : null}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.match_method ? MATCH_METHOD_LABEL[row.match_method] : '—'}
            </TableCell>
          </TableRow>
        );
      })}
    </ObservabilityTable>
  );
}
