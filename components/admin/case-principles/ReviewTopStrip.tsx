'use client';

import { CheckCircle2, FolderOpen, Inbox, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CasePrinciplesSummary } from '@/types/admin-case-principles';

interface ReviewTopStripProps {
  summary: CasePrinciplesSummary | undefined;
  isLoading: boolean;
  /** 1-based place of the open case in the rail; null when opened via search. */
  casePosition: number | null;
  /** Rows dealt with since the screen was opened (optimistic, both actions). */
  sessionReviewed: number;
}

function StripCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Inbox;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-lg font-semibold tabular-nums leading-6">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/**
 * What is left and where you are. This replaces the old stat cards on purpose:
 * "Reviewed today" read 0 all day and the max-100 warning could never appear,
 * so the strip now carries only numbers the reviewer can act on.
 */
export function ReviewTopStrip({
  summary,
  isLoading,
  casePosition,
  sessionReviewed,
}: ReviewTopStripProps) {
  if (isLoading || !summary) {
    return (
      <Card>
        <CardContent className="grid grid-cols-2 gap-px p-0 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="w-full space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-4 lg:divide-x lg:divide-border">
        <StripCell
          icon={Inbox}
          label="Principles left"
          value={summary.unreviewed.toLocaleString()}
          hint="Across the whole queue"
        />
        <StripCell
          icon={FolderOpen}
          label="Cases left"
          value={summary.cases_with_unreviewed.toLocaleString()}
          hint="With unreviewed rows"
        />
        <StripCell
          icon={MapPin}
          label="Position"
          value={
            casePosition !== null
              ? `Case ${casePosition} of ${summary.cases_with_unreviewed.toLocaleString()}`
              : '—'
          }
          hint={casePosition !== null ? 'In the pending list' : 'Opened via search'}
        />
        <StripCell
          icon={CheckCircle2}
          label="This session"
          value={sessionReviewed.toLocaleString()}
          hint="Approved or rejected here"
        />
      </CardContent>
    </Card>
  );
}
