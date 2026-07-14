'use client';

import { type KeyboardEvent, useState } from 'react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  useAddListItem,
  useCurrentUserUuid,
  useDeleteList,
  useList,
  useReorderListItems,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import {
  formatFullTimestamp,
  formatRelativeTime,
} from '@/lib/utils/collab';
import type { Channel } from '@/types/collab';

import { ListCreatorLabel } from './ListCreatorLabel';
import { ListFormDialog } from './ListFormDialog';
import { ListItemRow } from './ListItemRow';
import { ListProgress } from './ListProgress';

const ITEM_MAX = 1000;

interface ListDetailViewProps {
  channel: Channel;
  listUuid: string;
  onBack: () => void;
}

/** Placeholder scaffold while a list's detail loads. */
function ListDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="space-y-2 pt-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Compose + append a new item to the list (any member). */
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
        onError: (error) => {
          setValue(content);
          toast.error('Could not add item', {
            description: extractApiError(error).message,
          });
        },
      }
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        maxLength={ITEM_MAX}
        placeholder="Add an item…"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Add an item"
        className="flex-1"
      />
      <Button
        type="button"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        onClick={submit}
        disabled={!value.trim()}
        aria-label="Add item"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * The detail view for one task list: header (back, title, description, progress
 * and a manage menu), the items, and an add-item composer. A deleted or
 * access-lost list surfaces via the error state with a "Back to lists"
 * affordance — never via a setState-in-effect.
 */
export function ListDetailView({
  channel,
  listUuid,
  onBack,
}: ListDetailViewProps) {
  const { data, isLoading, isError, error, refetch } = useList(listUuid);
  const currentUserUuid = useCurrentUserUuid();
  const deleteList = useDeleteList(channel.uuid, listUuid);
  const reorder = useReorderListItems(channel.uuid, listUuid);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Pointer needs an 8px activation distance so a plain click on the checkbox,
  // content or delete button never starts a drag; keyboard sensor gives an
  // accessible pick-up/move/drop flow (Space to grab, arrows to move).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (isLoading) {
    return <ListDetailSkeleton />;
  }

  if (isError || !data) {
    const status = isError ? extractApiError(error).status : 0;
    const gone = status === 403 || status === 404;
    return (
      <div className="flex flex-col items-center">
        <ErrorState
          title={
            gone ? 'This list is no longer available' : "Couldn't load list"
          }
          description={
            gone
              ? 'It may have been deleted, or you no longer have access to this channel.'
              : 'We couldn’t load this list. Please try again.'
          }
          retry={gone ? undefined : () => refetch()}
          className="pb-4"
        />
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to lists
        </Button>
      </div>
    );
  }

  const list = data.data;
  const checkedCount = list.items.filter((item) => item.is_checked).length;
  const canManage =
    list.creator?.uuid === currentUserUuid ||
    channel.my_role === 'owner' ||
    channel.my_role === 'admin';

  // The reorder contract requires the FULL current set — every item exactly
  // once. While a pending add exists, its temporary `optimistic-` uuid isn't a
  // real server id, so no reorder can be sent (a partial/foreign set → 422).
  // We therefore disable dragging outright until the add reconciles.
  const orderedUuids = list.items.map((item) => item.uuid);
  const hasPendingItem = orderedUuids.some((uuid) =>
    uuid.startsWith('optimistic-')
  );
  const dragDisabled = hasPendingItem;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedUuids.indexOf(String(active.id));
    const newIndex = orderedUuids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderedUuids, oldIndex, newIndex);
    reorder.mutate(newOrder, {
      onError: (err) => {
        toast.error('Could not reorder items', {
          description: extractApiError(err).message,
        });
      },
    });
  };

  const handleDelete = async () => {
    try {
      await deleteList.mutateAsync();
      setDeleteOpen(false);
      toast.success('List deleted');
      onBack();
    } catch (err) {
      toast.error('Could not delete list', {
        description: extractApiError(err).message,
      });
    }
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
            className="-ml-1 h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 text-base font-semibold leading-tight">
                {list.title}
              </h2>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label="List settings"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                      <Pencil className="h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {list.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {list.description}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <ListCreatorLabel isAi={list.is_ai} creator={list.creator} />
              <time
                dateTime={list.updated_at}
                title={formatFullTimestamp(list.updated_at)}
                className="text-xs text-muted-foreground"
              >
                Updated {formatRelativeTime(list.updated_at)}
              </time>
            </div>
          </div>
        </div>

        {list.items.length > 0 && (
          <ListProgress checked={checkedCount} total={list.items.length} />
        )}
      </div>

      {list.items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Add the first item to get this list going."
          className="py-8"
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedUuids}
            strategy={verticalListSortingStrategy}
          >
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
          list={list}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{list.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the list and all of its items for everyone. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteList.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleteList.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteList.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
