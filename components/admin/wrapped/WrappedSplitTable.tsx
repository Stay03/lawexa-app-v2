'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { percentText, type SplitRow } from './wrapped-admin';

interface WrappedSplitTableProps {
  /** "Personality" or "Campus": the first column's heading. */
  heading: string;
  rows: SplitRow[];
  /** The row whose students the list below shows, if any. */
  selected: string | null;
  /** Choosing a row filters the student list to it; choosing it again clears that filter. */
  onSelect: (key: string | null) => void;
  /** Rows the list cannot filter by show as plain text. Every row by default. */
  canSelect?: (key: string) => boolean;
}

function Rate({ count, rate }: { count: number; rate: number | null }) {
  return (
    <TableCell className="text-right tabular-nums">
      {count.toLocaleString()}
      <span className="ml-1.5 text-xs text-muted-foreground">{percentText(rate)}</span>
    </TableCell>
  );
}

/** Counts for one way of splitting the students, with each step's share of that group. */
export function WrappedSplitTable({ heading, rows, selected, onSelect, canSelect }: WrappedSplitTableProps) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No students in this edition yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{heading}</TableHead>
            <TableHead className="text-right">Have</TableHead>
            <TableHead className="text-right">Opened</TableHead>
            <TableHead className="text-right">Finished</TableHead>
            <TableHead className="text-right">Shared</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const active = selected === row.key;
            return (
              <TableRow key={row.key} data-state={active ? 'selected' : undefined}>
                <TableCell>
                  {canSelect && !canSelect(row.key) ? (
                    <span className="text-muted-foreground">{row.label}</span>
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        'text-left underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none',
                        active && 'font-medium'
                      )}
                      aria-pressed={active}
                      title={active ? 'Show every student' : `Show only ${row.label} in the list below`}
                      onClick={() => onSelect(active ? null : row.key)}
                    >
                      {row.label}
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.have.toLocaleString()}</TableCell>
                <Rate count={row.opened} rate={row.openedRate} />
                <Rate count={row.finished} rate={row.finishedRate} />
                <Rate count={row.shared} rate={row.sharedRate} />
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
