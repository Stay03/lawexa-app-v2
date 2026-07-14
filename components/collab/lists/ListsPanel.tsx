'use client';

import { useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useChannelLists } from '@/lib/hooks/useCollab';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types/collab';

import { ListCard } from './ListCard';
import { ListDetailView } from './ListDetailView';
import { ListFormDialog } from './ListFormDialog';

interface ListsPanelProps {
  channel: Channel;
  className?: string;
}

/** Card placeholders while the channel's lists load — mirrors the ListCard grid. */
function ListsIndexSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The channel's lists as a responsive grid of cards, with a create action. */
function ListsIndex({
  channel,
  onSelect,
}: {
  channel: Channel;
  onSelect: (listUuid: string) => void;
}) {
  const { data, isLoading, isError, refetch } = useChannelLists(channel.uuid);
  const [createOpen, setCreateOpen] = useState(false);

  const lists = data?.data ?? [];

  const renderBody = () => {
    if (isLoading) {
      return <ListsIndexSkeleton />;
    }
    if (isError) {
      return (
        <ErrorState
          title="Couldn't load lists"
          description="We couldn't load this channel's lists. Please try again."
          retry={() => refetch()}
        />
      );
    }
    if (lists.length === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="No lists yet"
          description="Create a shared task list to track work with everyone in this channel."
          action={{ label: 'New list', onClick: () => setCreateOpen(true) }}
        />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lists.map((list) => (
          <ListCard key={list.uuid} list={list} onSelect={onSelect} />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 pb-4">
        <h2 className="text-base font-semibold">Lists</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New list
        </Button>
      </div>

      {renderBody()}

      {createOpen && (
        <ListFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          channelUuid={channel.uuid}
          onCreated={onSelect}
        />
      )}
    </>
  );
}

/**
 * The Lists tab: a master/detail switch. With no list selected it shows the
 * index (create + a grid of cards); selecting a card — or creating a list —
 * opens the detail view, whose back action clears the selection.
 *
 * Selection lives in local state: `ChannelBody` lazy-mounts this panel per tab
 * visit, so returning to Lists sensibly starts at the index again.
 */
export function ListsPanel({ channel, className }: ListsPanelProps) {
  const [selectedListUuid, setSelectedListUuid] = useState<string | null>(null);

  return (
    <div className={cn('overflow-y-auto', className)}>
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        {selectedListUuid ? (
          <ListDetailView
            channel={channel}
            listUuid={selectedListUuid}
            onBack={() => setSelectedListUuid(null)}
          />
        ) : (
          <ListsIndex channel={channel} onSelect={setSelectedListUuid} />
        )}
      </div>
    </div>
  );
}
