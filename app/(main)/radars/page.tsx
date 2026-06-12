'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Radar as RadarIcon } from 'lucide-react';

import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import { RadarCard } from '@/components/radar/RadarCard';
import { RadarCardSkeleton } from '@/components/radar/RadarListSkeletons';
import { useRadars } from '@/lib/hooks/useRadars';
import type { RadarStatus } from '@/types/radar';

const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

const EMPTY_COPY: Record<RadarStatus, { title: string; description: string }> = {
  active: {
    title: 'No radars yet',
    description:
      'Create a radar to get scheduled AI reports on the legal topics, jurisdictions, and sources you care about.',
  },
  paused: {
    title: 'No paused radars',
    description: 'Radars you pause will appear here until you resume them.',
  },
  archived: {
    title: 'No archived radars',
    description:
      'Archived radars stop scanning permanently, but their past reports stay readable here.',
  },
};

export default function RadarsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RadarStatus>('active');
  const radarsQuery = useRadars({ status, per_page: 50 });
  const radars = radarsQuery.data?.data ?? [];

  const renderContent = () => {
    if (radarsQuery.isLoading) {
      return <RadarCardSkeleton />;
    }

    if (radarsQuery.isError) {
      return (
        <ErrorState
          title="Failed to load radars"
          description="We couldn't load your radars. Please try again."
          retry={() => radarsQuery.refetch()}
        />
      );
    }

    if (radars.length === 0) {
      const copy = EMPTY_COPY[status];
      return (
        <EmptyState
          icon={RadarIcon}
          title={copy.title}
          description={copy.description}
          action={
            status === 'active'
              ? {
                  label: 'Create your first radar',
                  onClick: () => router.push('/radars/new'),
                }
              : undefined
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        {radars.map((radar) => (
          <RadarCard key={radar.uuid} radar={radar} />
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Radar"
        description="Saved watches that scan the web and Lawexa for you on a schedule"
      >
        <Button asChild>
          <Link href="/radars/new">
            <Plus />
            New radar
          </Link>
        </Button>
      </PageHeader>

      <AnimatedTabs
        tabs={TABS}
        value={status}
        onValueChange={(value) => setStatus(value as RadarStatus)}
      />

      {renderContent()}
    </PageContainer>
  );
}
