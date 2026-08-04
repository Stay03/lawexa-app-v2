'use client';

import { useQuery } from '@tanstack/react-query';
import { ListChecks, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Channel, TaskListSummary } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { channelsQueries } from '../queries';
import { RelativeTime } from '../ui/RelativeTime';
import { ListCreatorLabel, ListProgress } from './list-bits';
import { ListDetail } from './ListDetail';
import { ListFormDialog } from './ListFormDialog';

/**
 * ListsTab — the channel's shared task lists: an index of house-grammar rows
 * and a master/detail switch whose selection lives in the URL (`?list=`,
 * quiet writes — study A5's FIX: v1's local-state selection was
 * unaddressable and reset on every return). Selecting, creating and going
 * back all mirror into the URL, so a refresh or a shared link lands on the
 * same list. Index rows follow the two-zone meta grammar: identity in the
 * left zone, relative time right-anchored (exact on hover). Realtime
 * `.list.changed` keeps everything live through the N3 writers; the tab
 * itself just reads the cache. Phase-5 W2, 2026-08-04.
 *
 * BOTH URL VALUES RUN ON `useUrlOverlay` (owner round, Aug 4). `?list=` had the
 * quiet-write half of that pattern but no `popstate` adopter, so a Back that
 * restored an entry with a different selection left the wrong list on screen;
 * the hook supplies the listener. It keeps REPLACE for the selection — index
 * and detail are one stop, so Back leaves the tab rather than walking the
 * lists a reader opened — while `?new-list=` PUSHES, because the create dialog
 * IS an overlay and Back must close it. Its own key, not a value of the
 * channel's `?panel=`: one component must own each param, and the channel
 * screen owns that one.
 */
export function ListsTab({
  channel,
  viewerId,
  viewerUuid,
  initialListUuid,
}: {
  channel: Channel;
  viewerId: number | null;
  viewerUuid: string | null;
  initialListUuid: string | null;
}) {
  // The SSR fallback is real here, unlike a pure overlay's: this value swaps
  // index for detail IN TREE, so the server render and the hydration render
  // have to agree. Both derive from the same navigation URL.
  const selection = useUrlOverlay('list', { ssrValue: initialListUuid });
  const createPanel = useUrlOverlay('new-list');
  const selectedListUuid = selection.value;
  const { swap: selectList } = selection;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        {selectedListUuid ? (
          <ListDetail
            channel={channel}
            viewerId={viewerId}
            viewerUuid={viewerUuid}
            listUuid={selectedListUuid}
            onBack={() => selectList(null)}
          />
        ) : (
          <ListsIndex
            channel={channel}
            viewerId={viewerId}
            onSelect={selectList}
            onCreate={() => createPanel.show()}
          />
        )}
      </div>

      {/* Keyed on `openKey` so it stays mounted through its closing transition
          and re-derives its fields on every opening. */}
      <ListFormDialog
        key={createPanel.keyFor()}
        open={createPanel.open}
        onOpenChange={createPanel.setOpen}
        channelUuid={channel.uuid}
        viewerId={viewerId}
        onCreated={(listUuid) => {
          // Success is a MOVE, not a dismissal: the dialog's own entry is
          // rewritten into the new list's selection. Closing it the ordinary
          // way would pop that entry, and the `?list=` write on the next line
          // would go with it — leaving the reader back on the index.
          createPanel.closeInPlace();
          selectList(listUuid);
        }}
      />
    </div>
  );
}

function ListsIndex({
  channel,
  viewerId,
  onSelect,
  onCreate,
}: {
  channel: Channel;
  viewerId: number | null;
  onSelect: (listUuid: string) => void;
  onCreate: () => void;
}) {
  const listsQuery = useQuery(
    channelsQueries.taskLists({ channelUuid: channel.uuid, viewerId }),
  );
  const lists = listsQuery.data?.data ?? [];

  return (
    <>
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="text-base font-semibold">Lists</h2>
        <Button size="sm" onClick={onCreate}>
          <Plus aria-hidden className="size-4" />
          New list
        </Button>
      </div>

      {listsQuery.isPending ? (
        <ListsIndexSkeleton />
      ) : listsQuery.isError ? (
        <CollabMessage
          icon={ListChecks}
          tone="alert"
          title="Couldn't load lists"
          description="Something went wrong on our side. Please try again."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void listsQuery.refetch()}
            >
              Try again
            </Button>
          }
        />
      ) : lists.length === 0 ? (
        <CollabMessage
          icon={ListChecks}
          tone="neutral"
          title="No lists yet"
          description="Create a shared task list to track work with everyone in this channel."
          action={
            <Button size="sm" onClick={onCreate}>
              <Plus aria-hidden className="size-4" />
              New list
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col divide-y motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
          {lists.map((list) => (
            <ListIndexRow key={list.uuid} list={list} onSelect={onSelect} />
          ))}
        </div>
      )}
    </>
  );
}

/** One index row: title + progress, then the two-zone meta line. */
function ListIndexRow({
  list,
  onSelect,
}: {
  list: TaskListSummary;
  onSelect: (listUuid: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(list.uuid)}
      className={cn(
        'v2-interactive -mx-2 flex w-[calc(100%+1rem)] flex-col gap-2 rounded-lg px-2 py-3 text-left',
        'transition-colors duration-150 hover:bg-accent/40 motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium text-foreground">{list.title}</h3>
        {list.description && (
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
            {list.description}
          </p>
        )}
      </div>

      {list.items_count > 0 ? (
        <ListProgress checked={list.checked_count} total={list.items_count} />
      ) : (
        <p className="text-xs text-muted-foreground">No items yet</p>
      )}

      <div className="flex w-full items-center justify-between gap-2">
        <ListCreatorLabel isAi={list.is_ai} creator={list.creator} />
        <RelativeTime
          iso={list.updated_at}
          className="shrink-0 text-xs text-muted-foreground"
        />
      </div>
    </button>
  );
}

function ListsIndexSkeleton() {
  return (
    <div aria-hidden className="flex flex-col divide-y">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-2 py-3"
          style={{ opacity: Math.max(0.35, 1 - index * 0.25) }}
        >
          <Skeleton className="h-4 w-2/5 rounded" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
