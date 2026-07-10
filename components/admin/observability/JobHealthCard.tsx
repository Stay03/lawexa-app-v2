'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/utils/observability';

const COUNT_TONE: Record<StatusTone, string> = {
  neutral: 'text-foreground',
  info: 'text-sky-600 dark:text-sky-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
};

export interface JobHealthCount {
  label: string;
  value: number;
  tone?: StatusTone;
}

interface JobHealthCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  isLoading: boolean;
  counts: JobHealthCount[];
  redFlag?: { active: boolean; message: string };
  footer?: React.ReactNode;
}

/** One background-job family summarized on the combined ops dashboard. */
export function JobHealthCard({
  title,
  icon: Icon,
  href,
  isLoading,
  counts,
  redFlag,
  footer,
}: JobHealthCardProps) {
  return (
    <Card className={cn(redFlag?.active && 'border-destructive/40')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {counts.map((c) => (
                <div key={c.label}>
                  <p className={cn('text-xl font-semibold tabular-nums', COUNT_TONE[c.tone ?? 'neutral'])}>
                    {c.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>

            {redFlag?.active && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {redFlag.message}
              </div>
            )}

            {footer && <div className="text-xs text-muted-foreground">{footer}</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
