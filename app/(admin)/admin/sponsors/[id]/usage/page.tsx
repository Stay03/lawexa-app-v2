'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Hash,
  MessageSquare,
  Package,
  PackageCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';

import { CurrencySettings } from '@/components/admin/CurrencySettings';
import { SponsorStatsGrid } from '@/components/admin/sponsors/SponsorStatsGrid';
import { useSponsorUsage } from '@/lib/hooks/useAdminSponsors';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type {
  AdminCampaignStatus,
  AdminSponsorUsageCampaignRow,
} from '@/types/admin-sponsors';

const STATUS_STYLES: Record<AdminCampaignStatus, string> = {
  draft: 'text-muted-foreground border-border bg-muted/40',
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  ended:
    'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-amber-950/50',
};

export default function SponsorUsagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const sponsorId = Number(rawId);

  const { data, isLoading, error } = useSponsorUsage(sponsorId);
  const { showNGN, exchangeRate } = useCurrencyStore();
  const costOptions = { showNGN, exchangeRate };

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href={`/admin/sponsors/${sponsorId}`}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to sponsor
      </Link>
    </Button>
  );

  if (isNaN(sponsorId) || sponsorId <= 0) {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState message="Invalid sponsor ID" />
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

  const { sponsor, campaigns, totals } = data.data;

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {sponsor.name} usage
          </h1>
          <p className="text-sm text-muted-foreground">
            Rollup across every campaign owned by this sponsor.
          </p>
        </div>
        <CurrencySettings />
      </div>

      <SponsorStatsGrid
        columns={8}
        stats={[
          {
            label: 'Grants total',
            value: totals.grants_total.toLocaleString(),
            icon: Users,
          },
          {
            label: 'Active grants',
            value: totals.grants_active.toLocaleString(),
            icon: CheckCircle2,
          },
          {
            label: 'Packs total',
            value: totals.packs_total.toLocaleString(),
            icon: Package,
          },
          {
            label: 'Active packs',
            value: totals.packs_active.toLocaleString(),
            icon: PackageCheck,
          },
          {
            label: 'Messages sent',
            value: totals.messages_sent.toLocaleString(),
            icon: MessageSquare,
            subtext: 'Plan-funded + pack-funded',
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
            subtext: 'Plan side deduped, pack side exact',
          },
        ]}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Campaigns</h2>
              <CardDescription>
                Click a campaign for its full usage breakdown.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No campaigns yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium">
                      Campaign
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-center font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Issued</th>
                    <th className="px-4 py-3 text-right font-medium">Active</th>
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
                  {campaigns.map((row, index) => (
                    <CampaignRow
                      key={row.id}
                      row={row}
                      index={index}
                      costOptions={costOptions}
                    />
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">
                Plan-side rows: sum of per-campaign cost may exceed the sponsor
                total when a user holds overlapping grants — sponsor totals
                dedupe across campaigns and are authoritative. Pack-side rows
                are exact (every message is tagged with one pack).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignRow({
  row,
  index,
  costOptions,
}: {
  row: AdminSponsorUsageCampaignRow;
  index: number;
  costOptions: { showNGN: boolean; exchangeRate: number };
}) {
  const isPack = row.type === 'pack';
  const issued = isPack ? row.packs_total : row.grants_total;
  const active = isPack ? row.packs_active : row.grants_active;

  return (
    <tr
      className={cn(
        'border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors align-top',
        index % 2 === 1 && 'bg-muted/30'
      )}
      onClick={() => {
        window.location.href = `/admin/campaigns/${row.id}/usage`;
      }}
    >
      <td className="px-4 py-3 max-w-[280px] font-medium">
        <Link
          href={`/admin/campaigns/${row.id}/usage`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.name}
        </Link>
        {row.type === 'pack' && (
          <div className="text-xs text-muted-foreground tabular-nums">
            {row.messages_used.toLocaleString()} /{' '}
            {row.messages_funded.toLocaleString()} messages spent
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="text-xs">
          {isPack ? 'Pack' : 'Plan'}
        </Badge>
      </td>
      <td className="px-4 py-3 text-center">
        <Badge
          variant="outline"
          className={cn('text-xs', STATUS_STYLES[row.status])}
        >
          {row.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {issued.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {active.toLocaleString()}
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
