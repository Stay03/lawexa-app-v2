'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { AdminCampaignsTable } from '@/components/admin/sponsors/AdminCampaignsTable';
import { AdminSponsorDeleteDialog } from '@/components/admin/sponsors/AdminSponsorDeleteDialog';
import { AdminSponsorEditSheet } from '@/components/admin/sponsors/AdminSponsorEditSheet';
import { SponsorStatsGrid } from '@/components/admin/sponsors/SponsorStatsGrid';

import {
  useAdminSponsor,
  useSponsorCampaigns,
} from '@/lib/hooks/useAdminSponsors';

export default function SponsorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const sponsorId = Number(rawId);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: sponsorData, isLoading, error } = useAdminSponsor(sponsorId);
  const { data: campaignsData, isLoading: campaignsLoading } =
    useSponsorCampaigns(sponsorId, { per_page: 50 });

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href="/admin/sponsors">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Sponsors
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
        <Skeleton className="h-9 w-[280px]" />
        <Skeleton className="h-[180px] rounded-lg" />
        <Skeleton className="h-[220px] rounded-lg" />
      </div>
    );
  }

  if (error || !sponsorData?.data) {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState message="Sponsor not found" />
      </div>
    );
  }

  const sponsor = sponsorData.data;
  const campaigns = campaignsData?.data ?? [];

  return (
    <div className="space-y-6">
      {backLink}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2.5">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {sponsor.name}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  sponsor.is_active
                    ? 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50'
                    : 'text-muted-foreground'
                )}
              >
                {sponsor.is_active ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Active
                  </>
                ) : (
                  <>
                    <XCircle className="mr-1 h-3 w-3" />
                    Inactive
                  </>
                )}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{sponsor.slug}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/sponsors/${sponsor.id}/usage`}>
              <BarChart3 className="mr-1.5 h-4 w-4" />
              View usage
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <SponsorStatsGrid
        columns={2}
        stats={[
          {
            label: 'Campaigns',
            value: sponsor.campaigns_count,
            icon: Megaphone,
          },
          {
            label: 'Active campaigns',
            value: sponsor.active_campaigns_count ?? '—',
            icon: CheckCircle2,
          },
        ]}
      />

      {/* Contact + notes */}
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField
              label="Email"
              value={sponsor.contact_email ?? '—'}
            />
            <DetailField
              label="Name"
              value={sponsor.contact_name ?? '—'}
            />
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">
                Notes
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">
                {sponsor.notes || (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>
              Each campaign defines a plan, duration, and optional cap.
            </CardDescription>
          </div>
          <Button size="sm" asChild>
            <Link href={`/admin/sponsors/${sponsor.id}/campaigns/new`}>
              <Plus className="mr-1.5 h-4 w-4" />
              New campaign
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <AdminCampaignsTable
            campaigns={campaigns}
            isLoading={campaignsLoading}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AdminSponsorEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        sponsor={sponsor}
      />
      <AdminSponsorDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        sponsor={sponsor}
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
