'use client';

import { Inbox, CheckCircle2, FolderOpen, CalendarCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CasePrinciplesSummary } from '@/types/admin-case-principles';

interface PrincipleReviewSummaryProps {
  summary?: CasePrinciplesSummary;
  isLoading: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function PrincipleReviewSummary({ summary, isLoading }: PrincipleReviewSummaryProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full" />
        ))}
      </div>
    );
  }

  const { unreviewed, reviewed, cases_with_unreviewed, reviewed_today } = summary;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard icon={Inbox} label="Unreviewed" value={unreviewed} hint="In the queue" />
      <StatCard icon={CheckCircle2} label="Reviewed" value={reviewed} hint="Published" />
      <StatCard
        icon={FolderOpen}
        label="Cases pending"
        value={cases_with_unreviewed}
        hint="With unreviewed rows"
      />
      <StatCard
        icon={CalendarCheck}
        label="Reviewed today"
        value={reviewed_today}
        hint="Team velocity"
      />
    </div>
  );
}
