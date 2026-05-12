'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Users,
  XCircle,
  Hourglass,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { SponsorStatsGrid } from '@/components/admin/sponsors/SponsorStatsGrid';
import { useCampaignUsage } from '@/lib/hooks/useAdminSponsors';
import type { AdminCampaignStatus } from '@/types/admin-sponsors';

const STATUS_STYLES: Record<AdminCampaignStatus, string> = {
  draft: 'text-muted-foreground border-border bg-muted/40',
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  ended:
    'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-amber-950/50',
};

export default function CampaignUsagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const campaignId = Number(rawId);

  const { data, isLoading, error } = useCampaignUsage(campaignId);

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href={`/admin/campaigns/${campaignId}`}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to campaign
      </Link>
    </Button>
  );

  if (isNaN(campaignId) || campaignId <= 0) {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState message="Invalid campaign ID" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <Skeleton className="h-9 w-[260px]" />
        <Skeleton className="h-[120px] rounded-lg" />
        <Skeleton className="h-[280px] rounded-lg" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState message="Usage not available" />
      </div>
    );
  }

  const { campaign, totals, top_users } = data.data;

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {campaign.name} usage
        </h1>
        <Badge
          variant="outline"
          className={cn('text-xs', STATUS_STYLES[campaign.status])}
        >
          {campaign.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        {campaign.sponsor.name} · {campaign.plan.name} ·{' '}
        {campaign.duration_days}d per student
      </p>

      <SponsorStatsGrid
        columns={5}
        stats={[
          {
            label: 'Grants issued',
            value: totals.grants_issued.toLocaleString(),
            icon: Users,
          },
          {
            label: 'Active',
            value: totals.grants_active.toLocaleString(),
            icon: CheckCircle2,
          },
          {
            label: 'Revoked',
            value: totals.grants_revoked.toLocaleString(),
            icon: XCircle,
          },
          {
            label: 'Naturally expired',
            value: totals.grants_naturally_expired.toLocaleString(),
            icon: Hourglass,
          },
          {
            label: 'Messages sent',
            value: totals.messages_sent.toLocaleString(),
            icon: MessageSquare,
            subtext: 'Attributed via plan_granted tag',
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Top users by messages</CardTitle>
          <CardDescription>
            Granted students with the highest message volume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {top_users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No usage yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Granted</th>
                    <th className="px-4 py-3 text-left font-medium">Ends</th>
                    <th className="px-4 py-3 text-center font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Messages
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {top_users.map((row, index) => (
                    <tr
                      key={row.user.uuid}
                      className={cn(
                        'border-b last:border-b-0',
                        index % 2 === 1 && 'bg-muted/30'
                      )}
                    >
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="font-medium truncate">
                          {row.user.name || row.user.email}
                        </div>
                        {row.user.name && (
                          <div className="text-xs text-muted-foreground truncate">
                            {row.user.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(row.granted_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {row.ends_at
                          ? new Date(row.ends_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.revoked_at ? (
                          <Badge variant="outline" className="text-xs">
                            Revoked
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50'
                            )}
                          >
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {row.messages_sent.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border py-12">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-8 w-8 opacity-40" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}
