'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Hash,
  Hourglass,
  MessageSquare,
  Sparkles,
  Users,
  XCircle,
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
import { formatCost } from '@/lib/utils/currency';

import { CurrencySettings } from '@/components/admin/CurrencySettings';
import { SponsorStatsGrid } from '@/components/admin/sponsors/SponsorStatsGrid';
import { useCampaignUsage } from '@/lib/hooks/useAdminSponsors';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type {
  AdminCampaignStatus,
  AdminCampaignUsageTopUserGrant,
} from '@/types/admin-sponsors';

const STATUS_STYLES: Record<AdminCampaignStatus, string> = {
  draft: 'text-muted-foreground border-border bg-muted/40',
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  ended:
    'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-amber-950/50',
};

const ACTIVE_PILL =
  'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50';
const REVOKED_PILL =
  'text-muted-foreground border-border bg-muted/40';
const DELETED_PILL =
  'text-muted-foreground border-border bg-muted/40';

export default function CampaignUsagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const campaignId = Number(rawId);

  const { data, isLoading, error } = useCampaignUsage(campaignId);
  const { showNGN, exchangeRate } = useCurrencyStore();
  const costOptions = { showNGN, exchangeRate };

  const sortedTopUsers = useMemo(() => {
    if (!data?.data?.top_users) return [];
    return [...data.data.top_users].sort(
      (a, b) => Number(b.estimated_cost) - Number(a.estimated_cost)
    );
  }, [data]);

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

  const { campaign, totals } = data.data;

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex items-start justify-between gap-3">
        <div>
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
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign.sponsor.name} ·{' '}
            {campaign.type === 'pack'
              ? `Pack: ${campaign.pack_size?.toLocaleString() ?? '—'} messages`
              : `${campaign.plan?.name ?? '—'} · ${campaign.duration_days ?? '—'}d per student`}
          </p>
        </div>
        <CurrencySettings />
      </div>

      <SponsorStatsGrid
        columns={4}
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
          {
            label: 'AI requests',
            value: totals.ai_requests.toLocaleString(),
            icon: Sparkles,
            subtext: 'Billed LLM calls, errors excluded',
          },
          {
            label: 'Tokens',
            value: totals.tokens.total.toLocaleString(),
            icon: Hash,
            subtext: `${totals.tokens.prompt.toLocaleString()} prompt / ${totals.tokens.completion.toLocaleString()} completion`,
          },
          {
            label: 'Estimated cost',
            value: formatCost(totals.estimated_cost, costOptions),
            icon: DollarSign,
            subtext: 'USD, handover specialists included',
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Top users by estimated cost</CardTitle>
          <CardDescription>
            Granted students ranked by LLM spend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedTopUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No usage yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Grants</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Messages
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      AI requests
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Tokens</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Estimated cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTopUsers.map((row, index) => (
                    <tr
                      key={row.user.uuid}
                      className={cn(
                        'border-b last:border-b-0 align-top',
                        index % 2 === 1 && 'bg-muted/30'
                      )}
                    >
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {row.user.name || row.user.email}
                          </span>
                          {row.user.deleted_at && (
                            <Badge
                              variant="outline"
                              className={cn('text-xs shrink-0', DELETED_PILL)}
                            >
                              Deleted account
                            </Badge>
                          )}
                        </div>
                        {row.user.name && (
                          <div className="text-xs text-muted-foreground truncate">
                            {row.user.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {row.grants.map((grant, i) => (
                            <GrantChip key={i} grant={grant} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.messages_sent.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.ai_requests.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div>{row.tokens.total.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.tokens.prompt.toLocaleString()} /{' '}
                          {row.tokens.completion.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {formatCost(row.estimated_cost, costOptions)}
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

function GrantChip({ grant }: { grant: AdminCampaignUsageTopUserGrant }) {
  const start = new Date(grant.granted_at).toLocaleDateString();
  let endLabel: string;
  let pillClass: string;
  if (grant.revoked_at) {
    endLabel = `revoked ${new Date(grant.revoked_at).toLocaleDateString()}`;
    pillClass = REVOKED_PILL;
  } else if (grant.ends_at) {
    endLabel = `ends ${new Date(grant.ends_at).toLocaleDateString()}`;
    pillClass = ACTIVE_PILL;
  } else {
    endLabel = 'ongoing';
    pillClass = ACTIVE_PILL;
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-normal whitespace-nowrap justify-start',
        pillClass
      )}
    >
      {start} → {endLabel}
    </Badge>
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
