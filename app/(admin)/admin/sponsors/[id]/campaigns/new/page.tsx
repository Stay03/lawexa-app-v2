'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AdminCampaignForm } from '@/components/admin/sponsors/AdminCampaignForm';

export default function NewCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const sponsorId = Number(rawId);

  return (
    <div className="space-y-6">
      <Link href={`/admin/sponsors/${sponsorId}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sponsor
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-sm text-muted-foreground">
          Define the plan, duration, and optional cap. Campaign starts in draft.
        </p>
      </div>

      <AdminCampaignForm sponsorId={sponsorId} />
    </div>
  );
}
