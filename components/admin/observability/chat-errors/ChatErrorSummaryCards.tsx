'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  ObservabilityTable,
  StatusBadge,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import { chatErrorStageMeta } from './chat-error-stage';
import type { ChatErrorSummary } from '@/types/admin-chat-errors';

const CODE_COLUMNS: ObservabilityColumn[] = [
  { key: 'stage', label: 'Stage', className: 'w-[140px]' },
  { key: 'code', label: 'Code' },
  { key: 'count', label: 'Count', className: 'w-[90px] text-right' },
];

interface ChatErrorSummaryCardsProps {
  summary: ChatErrorSummary | undefined;
  isLoading: boolean;
}

/** The last 24 hours: the total, the count per stage, and the top codes. */
export function ChatErrorSummaryCards({ summary, isLoading }: ChatErrorSummaryCardsProps) {
  const pending = isLoading || !summary;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last 24 hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending ? (
            <>
              <Skeleton className="h-9 w-24" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-3xl font-semibold tabular-nums">{summary.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">errors</p>
              </div>
              {summary.by_stage.length === 0 ? (
                <p className="text-sm text-muted-foreground">None in this window</p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.by_stage.map(({ stage, count }) => (
                    <li key={stage} className="flex items-center justify-between gap-2">
                      <StatusBadge meta={chatErrorStageMeta(stage)} />
                      <span className="text-sm tabular-nums">{count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top codes</CardTitle>
        </CardHeader>
        <CardContent>
          <ObservabilityTable
            columns={CODE_COLUMNS}
            isLoading={pending}
            isEmpty={!summary || summary.by_code.length === 0}
            emptyText="No codes in the last 24 hours"
            skeletonRows={4}
          >
            {summary?.by_code.map((row, index) => (
              <TableRow
                key={`${row.stage}:${row.error_code ?? ''}`}
                className={cn(index % 2 === 1 && 'bg-muted/20')}
              >
                <TableCell>
                  <StatusBadge meta={chatErrorStageMeta(row.stage)} />
                </TableCell>
                <TableCell>
                  {row.error_code ? (
                    <span className="font-mono text-xs">{row.error_code}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">no code</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {row.count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </ObservabilityTable>
        </CardContent>
      </Card>
    </div>
  );
}
