'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AdminPlanDetailSubscription } from '@/types/admin-plans';

const STATUS_STYLES: Record<string, string> = {
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  past_due:
    'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  cancelled:
    'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
  expired: 'text-muted-foreground border-border',
  trialing:
    'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
};

interface AdminPlanSubscriptionsTableProps {
  subscriptions: AdminPlanDetailSubscription[];
}

export function AdminPlanSubscriptionsTable({
  subscriptions,
}: AdminPlanSubscriptionsTableProps) {
  if (!subscriptions || subscriptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Recent Subscriptions</CardTitle>
              <CardDescription>Up to 10 most recent subscriptions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex h-[120px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Users className="h-8 w-8 opacity-40" />
          <p className="text-sm">No subscriptions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Recent Subscriptions</CardTitle>
            <CardDescription>
              {subscriptions.length} most recent subscription{subscriptions.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left font-medium">User</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium">Started</th>
                <th className="px-4 py-2.5 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub, index) => (
                <tr
                  key={sub.id}
                  className={cn(
                    'border-b last:border-b-0',
                    index % 2 === 1 && 'bg-muted/30'
                  )}
                >
                  <td className="px-4 py-2.5 max-w-[180px]">
                    <Link
                      href={`/admin/users/${sub.user.uuid}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="font-medium truncate">{sub.user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {sub.user.email}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs capitalize',
                        STATUS_STYLES[sub.status] || ''
                      )}
                    >
                      {sub.status_label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {sub.currency} {sub.amount}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {sub.start_date
                      ? format(new Date(sub.start_date), 'MMM d, yyyy')
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {format(new Date(sub.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
