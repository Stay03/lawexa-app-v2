'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { AdminBulkGrantForm } from '@/components/admin/sponsors/AdminBulkGrantForm';
import { AdminBulkGrantResult } from '@/components/admin/sponsors/AdminBulkGrantResult';

import { useAdminCampaign } from '@/lib/hooks/useAdminSponsors';
import type { AdminBulkGrantResult as AdminBulkGrantResultData } from '@/types/admin-sponsors';

export default function BulkGrantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const campaignId = Number(rawId);

  const [result, setResult] = useState<AdminBulkGrantResultData | null>(null);

  const { data, isLoading, error } = useAdminCampaign(campaignId);

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
        <Skeleton className="h-9 w-[280px]" />
        <Skeleton className="h-[380px] rounded-lg" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState message="Campaign not found" />
      </div>
    );
  }

  const campaign = data.data;

  if (campaign.status !== 'active') {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-6">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Campaign is not active
          </p>
          <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-1">
            This campaign is currently <strong>{campaign.status_label}</strong>.
            Activate it before issuing grants.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backLink}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {campaign.type === 'pack'
            ? 'Grant message packs'
            : 'Grant subscriptions'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {campaign.sponsor.name} · {campaign.name} ·{' '}
          {campaign.type === 'pack' ? (
            <>
              <strong>{campaign.pack_size.toLocaleString()}</strong> messages
              per student
            </>
          ) : (
            <>
              {campaign.duration_days}-day grants on{' '}
              <strong>{campaign.plan.name}</strong>
            </>
          )}
        </p>
      </div>

      {result ? (
        <AdminBulkGrantResult
          result={result}
          onReset={() => setResult(null)}
          campaignType={campaign.type}
          packSize={campaign.type === 'pack' ? campaign.pack_size : null}
        />
      ) : (
        <AdminBulkGrantForm
          campaignId={campaignId}
          onResult={setResult}
          campaignType={campaign.type}
        />
      )}
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
