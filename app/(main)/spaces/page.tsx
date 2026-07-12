'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Boxes, Mail, Plus } from 'lucide-react';

import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer, PageHeader } from '@/components/layout';
import { SpaceCard } from '@/components/collab/SpaceCard';
import { SpaceFormDialog } from '@/components/collab/SpaceFormDialog';
import { SpacesListSkeleton } from '@/components/collab/skeletons';
import { usePendingInvitationCount, useSpaces } from '@/lib/hooks/useCollab';
import type { SpaceType } from '@/types/collab';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'work', label: 'Work' },
  { value: 'study', label: 'Study' },
];

type SpaceFilter = 'all' | SpaceType;

export default function SpacesPage() {
  const [filter, setFilter] = useState<SpaceFilter>('all');
  const spacesQuery = useSpaces({
    type: filter === 'all' ? undefined : filter,
    per_page: 50,
  });
  const spaces = spacesQuery.data?.data ?? [];
  const pendingInvitations = usePendingInvitationCount();
  const [createOpen, setCreateOpen] = useState(false);

  const renderContent = () => {
    if (spacesQuery.isLoading) {
      return <SpacesListSkeleton />;
    }

    if (spacesQuery.isError) {
      return (
        <ErrorState
          title="Couldn't load your spaces"
          description="We couldn't load your spaces. Please try again."
          retry={() => spacesQuery.refetch()}
        />
      );
    }

    if (spaces.length === 0) {
      return (
        <EmptyState
          icon={Boxes}
          title={filter === 'all' ? 'No spaces yet' : `No ${filter} spaces`}
          description={
            filter === 'all'
              ? 'Create a space or accept an invitation to get started.'
              : 'Try a different filter to see your other spaces.'
          }
          action={
            filter === 'all'
              ? { label: 'Create space', onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {spaces.map((space) => (
          <SpaceCard key={space.uuid} space={space} />
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Spaces"
        description="Your work and study spaces — jump into a channel to catch up."
      >
        <Button asChild variant="outline">
          <Link href="/invitations">
            <Mail className="h-4 w-4" />
            Invitations
            {pendingInvitations > 0 && (
              <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full px-1.5 tabular-nums">
                {pendingInvitations}
              </Badge>
            )}
          </Link>
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New space
        </Button>
      </PageHeader>

      <AnimatedTabs
        tabs={TABS}
        value={filter}
        onValueChange={(value) => setFilter(value as SpaceFilter)}
      />

      {renderContent()}

      {createOpen && (
        <SpaceFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </PageContainer>
  );
}
