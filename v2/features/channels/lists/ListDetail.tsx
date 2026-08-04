'use client';

import { useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  ArrowUp,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel } from '@/types/collab';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import {
  useAddListItem,
  useDeleteList,
  useReorderListItems,
} from '../lists-files-mutations';
import { canManageList, isLocalItemUuid, LIST_ITEM_MAX } from '../model';
import { channelsQueries } from '../queries';
import { RelativeTime } from '../ui/RelativeTime';
import { ListCreatorLabel, ListProgress } from './list-bits';
import { ListFormDialog } from './ListFormDialog';
import { ListItemRow } from './ListItemRow';

/**
 * ListDetail — one task list: header (back, title, manage menu, creator +
 * updated meta, progress), the sortable items, and the add-item composer.
 * A v2 port of v1's `ListDetailView` (study A5 KEEP throughout) on the v2
 * keys and writers. Reordering sends the FULL uuid set, so dragging disables
 * outright while any optimistic add holds a temp uuid (v1's exact rule). A
 * deleted or access-lost list (403/404) resolves into a designed gone-state
 * with a way back — never a redirect. Phase-5 W2, 2026-08-04.
 */
export function ListDetail({
  channel,
  viewerId,
  viewerUuid,
  listUuid,
  onBack,
}: {
  channel: Channel;
  viewerId: number | null;
  viewerUuid: string | null;
  listUuid: string;
  onBack: () => void;
}) {
  const detailQuery = useQuery(channelsQueries.taskListDetail(listUuid, { viewerId }));
  const deleteList = useDeleteList(channel.uuid, listUuid);
  const reorder = useReorderListItems(channel.uuid, listUuid);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Pointer: an 8px activation distance so plain clicks never start a drag;
  // keyboard: Space grabs, arrows move, Space drops (dnd-kit's a11y flow).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (detailQuery.isPending) {
    return <ListDetailSkeleton />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    const status = detailQuery.isError
      ? extractApiError(detailQuery.error).status
      : 0;
    const gone = status === 403 || status === 404;
    return (
      <CollabMessage
        icon={ListChecks}
        tone={gone ? 'neutral' : 'alert'}
        title={gone ? 'This list is no longer available' : "Couldn't load this list"}
        description={
          gone
            ? 'It may have been deleted, or you no longer have access to this channel.'
            : 'Something went wrong on our side. Please try again.'
        }
        action={
          <div className="flex items-center gap-2">
            {!gone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void detailQuery.refetch()}
              >
                Try again
              </Button>
            )}
            <Button variant={gone ? 'outline' : 'ghost'} size="sm" onClick={onBack}>
              <ArrowLeft aria-hidden className="size-4" />
              Back to lists
            </Button>
          </div>
        }
      />
    );
  }

  const list = detailQuery.data.data;
  const checkedCount = list.items.filter((item) => item.is_checked).length;
  const canManage = canManageList(list, channel, viewerUuid);

  const orderedUuids = list.items.map((item) => item.uuid);
  const dragDisabled = orderedUuids.some(isLocalItemUuid);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedUuids.indexOf(String(active.id));
    const newIndex = orderedUuids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    reorder.mutate(arrayMove(orderedUuids, oldIndex, newIndex));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to lists"
            className="-ml-1 size-8 shrink-0"
          >
            <ArrowLeft aria-hidden className="size-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 text-base leading-tight font-semibold">
                {list.title}
              </h2>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="List options"
                    >
                      <MoreHorizontal aria-hidden className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                      <Pencil aria-hidden className="size-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {list.description && (
              <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>
            )}

            {/* Two-zone meta: identity left, time right-anchored. */}
            <div className="mt-2 flex items-center justify-between gap-3">
              <ListCreatorLabel isAi={list.is_ai} creator={list.creator} />
              <RelativeTime
                iso={list.updated_at}
                prefix="Updated"
                className="shrink-0 text-xs text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {list.items.length > 0 && (
          <ListProgress checked={checkedCount} total={list.items.length} />
        )}
      </div>

      {list.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No items yet — add the first one below.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedUuids} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {list.items.map((item) => (
                <ListItemRow
                  key={item.uuid}
                  item={item}
                  channelUuid={channel.uuid}
                  listUuid={list.uuid}
                  dragDisabled={dragDisabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddItemComposer channelUuid={channel.uuid} listUuid={list.uuid} />

      {renameOpen && (
        <ListFormDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          channelUuid={channel.uuid}
          viewerId={viewerId}
          list={list}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{list.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the list and all of its items for everyone. This
              can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteList.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                deleteList.mutate(undefined, {
                  onSuccess: () => {
                    setDeleteOpen(false);
                    onBack();
                  },
                });
              }}
              disabled={deleteList.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteList.isPending && (
                <Loader2 aria-hidden className="mr-1 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Compose + append (any member; 60/min server throttle). Failed adds roll
 *  back and re-fill the input so nothing typed is ever lost. */
function AddItemComposer({
  channelUuid,
  listUuid,
}: {
  channelUuid: string;
  listUuid: string;
}) {
  const [value, setValue] = useState('');
  const addItem = useAddListItem(channelUuid, listUuid);

  const submit = () => {
    const content = value.trim();
    if (!content) return;
    setValue('');
    addItem.mutate(
      { content },
      {
        onError: () => setValue(content),
      },
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // IME composition's Enter confirms the composition, never the add (M5).
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        maxLength={LIST_ITEM_MAX}
        placeholder="Add an item…"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Add an item"
        className="flex-1"
      />
      <Button
        type="button"
        size="icon"
        className="size-9 shrink-0 rounded-full"
        onClick={submit}
        disabled={!value.trim()}
        aria-label="Add item"
      >
        <ArrowUp aria-hidden className="size-4" />
      </Button>
    </div>
  );
}

function ListDetailSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <Skeleton className="h-5 w-1/2 rounded" />
      <Skeleton className="h-3 w-3/4 rounded" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="space-y-2 pt-2">
        {[0, 1, 2].map((index) => (
          <div key={index} style={{ opacity: Math.max(0.35, 1 - index * 0.25) }}>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
