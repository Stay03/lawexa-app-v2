'use client';

import { TableCell, TableRow } from '@/components/ui/table';
import { ObservabilityTable, StatusBadge, TimeAgoCell, UserCell } from '../index';
import { RunProgress } from './RunProgress';
import { RUN_TYPE_LABEL, runStatusMeta } from './status';
import type { CaseMaintenanceRun } from '@/types/admin-case-maintenance-runs';

const COLUMNS = [
  { key: 'type', label: 'Run' },
  { key: 'status', label: 'Status' },
  { key: 'progress', label: 'Progress', className: 'w-[38%]' },
  { key: 'started', label: 'Started' },
  { key: 'by', label: 'Started by' },
];

/**
 * Every maintenance run, newest first.
 *
 * The progress column is the widest one on purpose: it is the only thing on
 * this screen that answers the question somebody opens it to ask, which is
 * whether the thing they started overnight is still going and whether it has
 * done any good.
 */
export function CaseMaintenanceRunsTable({
  runs,
  isLoading,
  onOpen,
}: {
  runs: CaseMaintenanceRun[];
  isLoading: boolean;
  onOpen: (run: CaseMaintenanceRun) => void;
}) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={runs.length === 0}
      emptyText="Nothing has been run yet"
    >
      {runs.map((run) => (
        <TableRow
          key={run.uuid}
          className="cursor-pointer"
          onClick={() => onOpen(run)}
          /* A row that only responds to a mouse is a row a keyboard cannot
             reach. The sibling tables open a dialog the same way. */
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(run);
            }
          }}
        >
          <TableCell className="font-medium">{RUN_TYPE_LABEL[run.type]}</TableCell>
          <TableCell>
            <StatusBadge meta={runStatusMeta(run.status)} />
          </TableCell>
          <TableCell>
            <RunProgress run={run} />
          </TableCell>
          <TableCell>
            <TimeAgoCell value={run.started_at ?? run.created_at} />
          </TableCell>
          <TableCell>
            <UserCell user={run.created_by} />
          </TableCell>
        </TableRow>
      ))}
    </ObservabilityTable>
  );
}
