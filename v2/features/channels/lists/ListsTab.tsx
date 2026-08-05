'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel } from '@/types/collab';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { channelsQueries } from '../queries';
import { ListCard } from './ListCard';
import { ListDetail } from './ListDetail';
import { ListFormDialog } from './ListFormDialog';
import { ListsEmptyState, ListsErrorState, ListsIndexSkeleton } from './states';

/**
 * ListsTab — the channel's shared task lists: a card index and a detail view,
 * with the selection in the URL (`?list=`, quiet writes — study A5's FIX:
 * v1's local-state selection was unaddressable and reset on every return).
 *
 * BOTH URL VALUES RUN ON `useUrlOverlay` (owner round, Aug 4). `?list=` had
 * the quiet-write half of that pattern but no `popstate` adopter, so a Back
 * that restored an entry with a different selection left the wrong list on
 * screen; the hook supplies the listener. It keeps REPLACE for the selection —
 * index and detail are one stop, so Back leaves the tab rather than walking
 * the lists a reader opened — while `?new-list=` PUSHES, because the create
 * dialog IS an overlay and Back must close it. Its own key, not a value of the
 * channel's `?panel=`: one component must own each param.
 *
 * ── THE SWAP NOW MOVES ─────────────────────────────────────────────────────
 * Index↔detail had NO motion at all, which the house rules ban outright: a
 * whole pane replacing another with no transition reads as a page load inside
 * a tab. It now slides 180ms — detail in from the right, index back in from
 * the left — so the movement says which direction you went, and `motion-reduce`
 * drops it to the instant swap.
 *
 * Only ONE pane is mounted at a time (the detail owns a query and a dnd
 * context; keeping both alive to cross-fade them would double that for a
 * fifth of a second), so the ENTERING pane carries the whole gesture and the
 * mirror is in its direction.
 *
 * The animation is armed by the SELECTION CHANGING, not by a click handler.
 * Arming it in the handlers looked equivalent and was not: a Back or Forward
 * that restores a different `?list=` moves the selection without any handler
 * running, so the first such swap would have been instant and every later one
 * animated — motion that depends on how you got here rather than on what
 * moved. Comparing the rendered selection against the last one is the
 * sanctioned "adjust state during render" reset (the same shape
 * `useUrlSearch` uses, and the one form of a state write React allows in
 * render); the first paint of the tab still has nothing to compare against, so
 * it stays still, exactly like every other first paint in the product.
 *
 * Phase-5 W2; rebuilt for the redesign wave, 2026-08-05.
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

  // The last selection this component rendered, and whether it has ever
  // changed. Compared IN RENDER so every route the selection can move by —
  // a click, a create, a Back — arms the same motion.
  const [seen, setSeen] = useState<{ value: string | null; moved: boolean }>({
    value: selectedListUuid,
    moved: false,
  });
  if (seen.value !== selectedListUuid) {
    setSeen({ value: selectedListUuid, moved: true });
  }

  const openList = useCallback(
    (listUuid: string) => selectList(listUuid),
    [selectList],
  );
  const backToIndex = useCallback(() => selectList(null), [selectList]);

  const enter = !seen.moved
    ? undefined
    : cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-out',
        selectedListUuid
          ? 'motion-safe:slide-in-from-right-4'
          : 'motion-safe:slide-in-from-left-4',
      );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Keyed on the selection so the entering pane really is a new element —
          without the key React would reconcile one pane into the other and the
          entrance would never run. */}
      <div
        key={selectedListUuid ?? 'index'}
        className={cn('flex min-h-0 flex-1 flex-col', enter)}
      >
        {selectedListUuid ? (
          <ListDetail
            channel={channel}
            viewerId={viewerId}
            viewerUuid={viewerUuid}
            listUuid={selectedListUuid}
            onBack={backToIndex}
          />
        ) : (
          <ListsIndex
            channel={channel}
            viewerId={viewerId}
            onSelect={openList}
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
          openList(listUuid);
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
  const apiError = listsQuery.error ? extractApiError(listsQuery.error) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 className="text-base font-semibold">
            Lists
            {lists.length > 0 ? (
              <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
                {lists.length}
              </span>
            ) : null}
          </h2>
          <Button size="sm" onClick={onCreate}>
            <Plus aria-hidden className="size-4" />
            New list
          </Button>
        </div>

        {listsQuery.isPending ? (
          <ListsIndexSkeleton />
        ) : listsQuery.isError && lists.length === 0 ? (
          <ListsErrorState
            message={apiError?.message}
            onRetry={() => void listsQuery.refetch()}
          />
        ) : lists.length === 0 ? (
          <ListsEmptyState onCreate={onCreate} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lists.map((list, index) => (
              <ListCard
                key={list.uuid}
                list={list}
                onSelect={onSelect}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
