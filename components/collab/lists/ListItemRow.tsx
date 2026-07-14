'use client';

import { type KeyboardEvent, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDeleteListItem, useUpdateListItem } from '@/lib/hooks/useCollab';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { TaskListItem } from '@/types/collab';

import { LawexaAvatar } from '../LawexaAvatar';
import { MemberAvatar } from '../MemberAvatar';

const CONTENT_MAX = 1000;

interface ListItemRowProps {
  item: TaskListItem;
  channelUuid: string;
  listUuid: string;
  /**
   * Disables dragging for the whole list (e.g. while a pending add holds a
   * temporary uuid that must never enter a reorder payload).
   */
  dragDisabled?: boolean;
}

/**
 * A single task-list item: a leading drag-handle slot, a checkbox, the content
 * (click to edit inline), the person who checked it, and a delete action.
 * Checked items mute + strike their content.
 *
 * The row is sortable (Phase 3c): `useSortable` binds a transform/transition to
 * the root, but the drag listeners live ONLY on the leading `GripVertical`
 * handle, so the checkbox, inline-edit and delete keep their own pointer/keyboard
 * behavior. Dragging is disabled for an optimistic (pending-add) row, mid-edit,
 * or when the parent disables it (a temp uuid must never enter a reorder set).
 */
export function ListItemRow({
  item,
  channelUuid,
  listUuid,
  dragDisabled = false,
}: ListItemRowProps) {
  const updateItem = useUpdateListItem(channelUuid, listUuid);
  const deleteItem = useDeleteListItem(channelUuid, listUuid);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);

  const isOptimistic = item.uuid.startsWith('optimistic-');

  // A row can't be dragged while it's being inline-edited (the input owns the
  // pointer/keyboard), while it's an optimistic pending-add, or while the list
  // as a whole has dragging disabled (a pending add anywhere in the list).
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.uuid,
    disabled: isOptimistic || isEditing || dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleToggle = (checked: boolean) => {
    updateItem.mutate(
      { itemUuid: item.uuid, is_checked: checked },
      {
        onError: (error) => {
          toast.error('Could not update item', {
            description: extractApiError(error).message,
          });
        },
      }
    );
  };

  const startEditing = () => {
    setDraft(item.content);
    setIsEditing(true);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === item.content) {
      setIsEditing(false);
      setDraft(item.content);
      return;
    }
    updateItem.mutate(
      { itemUuid: item.uuid, content: trimmed },
      {
        onError: (error) => {
          toast.error('Could not save item', {
            description: extractApiError(error).message,
          });
        },
      }
    );
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(item.content);
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  };

  const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startEditing();
    }
  };

  const handleDelete = () => {
    deleteItem.mutate(item.uuid, {
      onError: (error) => {
        toast.error('Could not remove item', {
          description: extractApiError(error).message,
        });
      },
    });
  };

  const checkerName = item.is_ai ? 'Lawexa' : item.checked_by?.name;

  const canDrag = !isOptimistic && !isEditing && !dragDisabled;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-accent/40',
        isOptimistic && 'opacity-60',
        isDragging &&
          'relative z-10 bg-background opacity-90 shadow-md ring-1 ring-border'
      )}
    >
      {/* Drag handle — the ONLY draggable surface, so the checkbox, content and
          delete button keep working. Focusable + labeled for keyboard reorder. */}
      <button
        type="button"
        aria-label="Reorder item"
        disabled={!canDrag}
        {...attributes}
        {...listeners}
        className={cn(
          'flex w-5 shrink-0 touch-none items-center justify-center rounded text-muted-foreground/40 opacity-0 outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          canDrag ? 'cursor-grab' : 'cursor-default',
          isDragging && 'cursor-grabbing',
          !canDrag && 'pointer-events-none'
        )}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Checkbox
        checked={item.is_checked}
        onCheckedChange={(checked) => handleToggle(checked === true)}
        disabled={isOptimistic}
        aria-label={
          item.is_checked
            ? `Mark "${item.content}" as not done`
            : `Mark "${item.content}" as done`
        }
        className="shrink-0"
      />

      {isEditing ? (
        <Input
          autoFocus
          value={draft}
          maxLength={CONTENT_MAX}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={commitEdit}
          aria-label="Edit item"
          className="h-8 flex-1"
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={startEditing}
          onKeyDown={handleContentKeyDown}
          className={cn(
            'flex-1 cursor-text rounded px-1 py-0.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            item.is_checked
              ? 'text-muted-foreground line-through'
              : 'text-foreground'
          )}
        >
          {item.content}
        </div>
      )}

      {item.is_checked && checkerName && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0">
              {item.is_ai ? (
                <LawexaAvatar size="sm" />
              ) : (
                <MemberAvatar user={item.checked_by} size="sm" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>Checked by {checkerName}</TooltipContent>
        </Tooltip>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={isOptimistic || deleteItem.isPending}
        aria-label={`Remove "${item.content}"`}
        className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        {deleteItem.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
