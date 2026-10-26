'use client';

import Link from 'next/link';
import { FileText, MessageSquare, StickyNote, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { RadarAffectedItem, RadarAffectedItemType } from '@/types/radar';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { affectedRows, type AffectedRow } from './affected-items';

const TYPE_ICONS: Record<RadarAffectedItemType, LucideIcon> = {
  file: FileText,
  note: StickyNote,
  conversation: MessageSquare,
};

/**
 * "Affected in this Space": the space's files, notes and chats a report says
 * the change touches, each with why, after the report and before its sources
 * (plan 5.4). The Sources list's grammar: a label with its count and a
 * hairline, then rows that open the item. Nothing is drawn when the report
 * names none.
 */
export function AffectedItems({ items }: { items: readonly RadarAffectedItem[] | undefined }) {
  const rows = affectedRows(items);
  if (rows.length === 0) return null;

  return (
    <section aria-label="Affected in this Space" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="report-kicker shrink-0">
          Affected in this Space
          <span className="text-muted-foreground/50">
            {' · '}
            <span className="tabular-nums">{rows.length}</span>
          </span>
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border/60" />
      </div>

      <ul className="flex flex-col divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.key} className="flex min-w-0">
            <AffectedRowView row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AffectedRowView({ row }: { row: AffectedRow }) {
  const Icon = TYPE_ICONS[row.type] ?? FileText;
  const body = (
    <>
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', row.gone ? 'text-muted-foreground/50' : 'text-primary')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', row.gone ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>
          {row.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span>
      </span>
    </>
  );

  // `min-w-0` on the row too: a long name truncates on a phone (ReportSources).
  if (row.href) {
    return (
      <Link
        href={row.href}
        className={cn(
          'v2-interactive flex min-h-11 min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50',
          FOCUS_RING,
        )}
      >
        {body}
      </Link>
    );
  }
  return <span className="flex min-h-11 min-w-0 flex-1 items-start gap-2.5 px-2 py-2.5">{body}</span>;
}
