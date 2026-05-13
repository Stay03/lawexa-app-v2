'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Hourglass,
  MessageSquare,
  Megaphone,
  Package,
  PlayCircle,
  Plus,
  StopCircle,
  Users,
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

import { AdminCampaignActivateDialog } from '@/components/admin/sponsors/AdminCampaignActivateDialog';
import { AdminCampaignEndDialog } from '@/components/admin/sponsors/AdminCampaignEndDialog';
import { AdminGrantsTable } from '@/components/admin/sponsors/AdminGrantsTable';
import { SponsorStatsGrid } from '@/components/admin/sponsors/SponsorStatsGrid';

import {
  useAdminCampaign,
  useCampaignGrants,
} from '@/lib/hooks/useAdminSponsors';
import type { AdminCampaignStatus } from '@/types/admin-sponsors';

const STATUS_STYLES: Record<AdminCampaignStatus, string> = {
  draft: 'text-muted-foreground border-border bg-muted/40',
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  ended:
    'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-amber-950/50',
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const campaignId = Number(rawId);

  const [activateOpen, setActivateOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const { data: campaignData, isLoading, error } =
    useAdminCampaign(campaignId);
  const { data: grantsData, isLoading: grantsLoading } = useCampaignGrants(
    campaignId,
    { per_page: 50 }
  );

  const backLink = (campaign: { sponsor: { id: number; name: string } }) => (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href={`/admin/sponsors/${campaign.sponsor.id}`}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {campaign.sponsor.name}
      </Link>
    </Button>
  );

  if (isNaN(campaignId) || campaignId <= 0) {
    return (
      <div className="space-y-6">
        <BackToSponsors />
        <EmptyState message="Invalid campaign ID" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackToSponsors />
        <Skeleton className="h-9 w-[280px]" />
        <Skeleton className="h-[180px] rounded-lg" />
        <Skeleton className="h-[280px] rounded-lg" />
      </div>
    );
  }

  if (error || !campaignData?.data) {
    return (
      <div className="space-y-6">
        <BackToSponsors />
        <EmptyState message="Campaign not found" />
      </div>
    );
  }

  const campaign = campaignData.data;
  const grants = grantsData?.data ?? [];
  const activeGrantsCount =
    campaign.active_grants_count ??
    grants.filter((g) => g.is_active).length;

  return (
    <div className="space-y-6">
      {backLink(campaign)}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2.5">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {campaign.name}
              </h1>
              <Badge variant="outline" className="text-xs">
                {campaign.type_label}
              </Badge>
              <Badge
                variant="outline"
                className={cn('text-xs', STATUS_STYLES[campaign.status])}
              >
                {campaign.status_label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {campaign.sponsor.name} · {campaign.slug}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/campaigns/${campaign.id}/usage`}>
              <BarChart3 className="mr-1.5 h-4 w-4" />
              View usage
            </Link>
          </Button>
          {campaign.status === 'active' && (
            <Button size="sm" asChild>
              <Link href={`/admin/campaigns/${campaign.id}/grant`}>
                <Plus className="mr-1.5 h-4 w-4" />
                {campaign.type === 'pack'
                  ? 'Grant packs'
                  : 'Grant subscriptions'}
              </Link>
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button size="sm" onClick={() => setActivateOpen(true)}>
              <PlayCircle className="mr-1.5 h-4 w-4" />
              Activate
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEndOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <StopCircle className="mr-1.5 h-4 w-4" />
              End campaign
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <SponsorStatsGrid
        columns={4}
        stats={
          campaign.type === 'plan'
            ? [
                {
                  label: 'Plan',
                  value: campaign.plan.name,
                  icon: Megaphone,
                  subtext: campaign.plan.is_internal
                    ? 'Internal sponsor plan'
                    : null,
                },
                {
                  label: 'Duration / student',
                  value: `${campaign.duration_days}d`,
                  icon: Hourglass,
                },
                {
                  label: 'Grants issued',
                  value: campaign.grants_count ?? '—',
                  icon: Users,
                  subtext: campaign.max_grants
                    ? `Cap: ${campaign.max_grants}`
                    : 'No cap',
                },
                {
                  label: 'Active grants',
                  value: activeGrantsCount,
                  icon: CheckCircle2,
                },
              ]
            : [
                {
                  label: 'Pack size',
                  value: `${campaign.pack_size.toLocaleString()} msg`,
                  icon: Package,
                  subtext: 'Per student, one-shot',
                },
                {
                  label: 'Time limit',
                  value: '—',
                  icon: MessageSquare,
                  subtext: 'Packs do not expire',
                },
                {
                  label: 'Grants issued',
                  value: campaign.grants_count ?? '—',
                  icon: Users,
                  subtext: campaign.max_grants
                    ? `Cap: ${campaign.max_grants}`
                    : 'No cap',
                },
                {
                  label: 'Active grants',
                  value: activeGrantsCount,
                  icon: CheckCircle2,
                },
              ]
        }
      />

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <DetailField
              label="Starts"
              value={
                campaign.starts_at
                  ? new Date(campaign.starts_at).toLocaleString()
                  : '—'
              }
            />
            <DetailField
              label="Ends"
              value={
                campaign.ends_at
                  ? new Date(campaign.ends_at).toLocaleString()
                  : '—'
              }
            />
            <DetailField
              label="Created"
              value={new Date(campaign.created_at).toLocaleString()}
            />
            <div className="sm:col-span-3">
              <dt className="text-xs font-medium text-muted-foreground">
                Notes
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">
                {campaign.notes || (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Grants */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Grants</CardTitle>
            <CardDescription>
              {campaign.type === 'pack'
                ? 'Students who received a message pack from this campaign.'
                : 'Students whose subscriptions are being sponsored by this campaign.'}
            </CardDescription>
          </div>
          {campaign.status === 'active' && (
            <Button size="sm" asChild>
              <Link href={`/admin/campaigns/${campaign.id}/grant`}>
                <Plus className="mr-1.5 h-4 w-4" />
                Grant
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <AdminGrantsTable
            grants={grants}
            isLoading={grantsLoading}
            campaignType={campaign.type}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AdminCampaignActivateDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        campaign={campaign}
      />
      <AdminCampaignEndDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        campaign={campaign}
        activeGrantsCount={activeGrantsCount}
      />
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function BackToSponsors() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href="/admin/sponsors">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Sponsors
      </Link>
    </Button>
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
