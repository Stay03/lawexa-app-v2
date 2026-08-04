'use client';

import { useState, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { TaskListItem } from '@/types/collab';
import { useDeleteListItem, useUpdateListItem } from '../lists-files-mutations';
import { isLocalItemUuid, LIST_ITEM_MAX } from '../model';
import { LawexaAvatar, MemberAvatar } from '../ui/avatars';

/**
 * ListItemRow — one sortable task item: grip-handle-only dragging (the
 * checkbox, inline edit and delete keep their own pointer/keyboard
 * behaviour), optimistic check with checked-by identity, and inline content
 * editing. A v2 port of v1's row (study A5 KEEP: "grip-handle-only reorder —
 * correct, accessible enough, proven"). Dragging disables while ANY pending
 * add holds a temp uuid — a local uuid must never enter the reorder payload
 * (the endpoint wants the full real set exactly once). Phase-5 W2,
 * 2026-08-04.
 */
export function ListItemRow({
  item,
  channelUuid,
  listUuid,
  dragDisabled = false,
}: {
  item: TaskListItem;
  channelUuid: string;
  listUuid: string;
  dragDisabled?: boolean;
}) {
  const updateItem = useUpdateListItem(channelUuid, listUuid);
  const deleteItem = useDeleteListItem(channelUuid, listUuid);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);

  const isLocal = isLocalItemUuid(item.uuid);
  const canDrag = !isLocal && !isEditing && !dragDisabled;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.uuid,
      disabled: !canDrag,
    });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const commitEdit = () => {
    const trimmed = draft.trim();
    setIsEditing(false);
    if (!trimmed || trimmed === item.content) {
      setDraft(item.content);
      return;
    }
    updateItem.mutate({ itemUuid: item.uuid, content: trimmed });
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // IME composition's Enter confirms the composition, never the save (M5).
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsEditing(false);
      setDraft(item.content);
    }
  };

  const checkerName = item.is_ai ? 'Lawexa' : item.checked_by?.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5',
        'transition-colors duration-150 hover:bg-accent/40 motion-reduce:transition-none',
        isLocal && 'opacity-60',
        isDragging && 'relative z-10 bg-background opacity-90 shadow-md ring-1 ring-border',
      )}
    >
      {/* The grip — the ONLY draggable surface. Focusable + labelled for the
          keyboard pick-up/move/drop flow (Space grabs, arrows move). */}
      <button
        type="button"
        aria-label="Reorder item"
        disabled={!canDrag}
        {...attributes}
        {...listeners}
        className={cn(
          'flex w-5 shrink-0 touch-none items-center justify-center rounded text-muted-foreground/40 opacity-0 outline-none',
          'transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
          '[@media(hover:none)]:opacity-100',
          canDrag ? 'cursor-grab' : 'pointer-events-none cursor-default',
          isDragging && 'cursor-grabbing',
        )}
      >
        <GripVertical aria-hidden className="size-4" />
      </button>

      <Checkbox
        checked={item.is_checked}
        onCheckedChange={(checked) =>
          updateItem.mutate({ itemUuid: item.uuid, is_checked: checked === true })
        }
        disabled={isLocal}
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
          maxLength={LIST_ITEM_MAX}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={commitEdit}
          aria-label="Edit item"
          className="h-8 flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(item.content);
            setIsEditing(true);
          }}
          className={cn(
            'flex-1 cursor-text rounded px-1 py-0.5 text-left text-sm outline-none',
            'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
            item.is_checked ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {item.content}
        </button>
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
        onClick={() => deleteItem.mutate(item.uuid)}
        disabled={isLocal || deleteItem.isPending}
        aria-label={`Remove "${item.content}"`}
        className={cn(
          'size-7 shrink-0 text-muted-foreground opacity-0',
          'transition-opacity duration-150 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 motion-reduce:transition-none',
          '[@media(hover:none)]:opacity-100',
        )}
      >
        {deleteItem.isPending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Trash2 aria-hidden className="size-4" />
        )}
      </Button>
    </div>
  );
}
