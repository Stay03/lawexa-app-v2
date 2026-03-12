'use client';

import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Star,
  Table2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AdminPlanListItem } from '@/types/admin-plans';

const STATUS_STYLES = {
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  inactive:
    'text-muted-foreground border-border',
};

function LimitSummary({ limits }: { limits: AdminPlanListItem['limits'] }) {
  if (!limits || limits.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground cursor-default">
            {limits.length} limit{limits.length !== 1 ? 's' : ''}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[250px]">
          <div className="space-y-1 text-xs">
            {limits.map((l) => (
              <div key={l.type} className="flex justify-between gap-3">
                <span className="capitalize">{l.type.replace(/_/g, ' ')}</span>
                <span className="font-medium tabular-nums">
                  {l.is_unlimited ? '∞' : l.value}
                  <span className="text-muted-foreground ml-1">/ {l.period}</span>
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AdminPlansTableProps {
  plans: AdminPlanListItem[];
  isLoading: boolean;
}

export function AdminPlansTable({
  plans,
  isLoading,
}: AdminPlansTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[600px]" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Table2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No plans found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Interval</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-center font-medium">Featured</th>
              <th className="px-4 py-3 text-center font-medium">Trial</th>
              <th className="px-4 py-3 text-right font-medium">Subscribers</th>
              <th className="px-4 py-3 text-right font-medium">Limits</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, index) => (
              <tr
                key={plan.id}
                className={cn(
                  'border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50',
                  index % 2 === 1 && 'bg-muted/30'
                )}
                onClick={() => router.push(`/admin/plans/${plan.id}`)}
              >
                <td className="px-4 py-3 max-w-[200px]">
                  <div className="font-medium truncate">{plan.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {plan.slug}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  {plan.formatted_amount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {plan.interval_label}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      plan.is_active
                        ? STATUS_STYLES.active
                        : STATUS_STYLES.inactive
                    )}
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  {plan.is_featured ? (
                    <Star className="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {plan.trial_eligible ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {plan.subscriptions_count}
                </td>
                <td className="px-4 py-3 text-right">
                  <LimitSummary limits={plan.limits} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
