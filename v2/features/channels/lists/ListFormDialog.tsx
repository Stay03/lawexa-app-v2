'use client';

import { useState, type KeyboardEvent } from 'react';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import type { CreateListItemInput, TaskList } from '@/types/collab';
import { useCreateList, useUpdateList } from '../lists-files-mutations';
import {
  LIST_DESCRIPTION_MAX,
  LIST_ITEM_MAX,
  LIST_MAX_ITEMS,
  LIST_TITLE_MAX,
} from '../model';

/**
 * ListFormDialog — create (with the optional initial-items repeater the
 * create endpoint accepts) or edit (title + description only) a task list.
 * A v2 port of v1's dialog (study A5 KEEP); failures surface inline. On
 * create the new list's uuid bubbles up so the tab opens it straight away.
 * Phase-5 W2, 2026-08-04.
 */

interface ItemDraft {
  /** Stable key so repeater rows never re-key by array index. */
  key: string;
  content: string;
}

let itemDraftCounter = 0;
function newItemDraft(): ItemDraft {
  itemDraftCounter += 1;
  return { key: `draft-${itemDraftCounter}`, content: '' };
}

export function ListFormDialog({
  open,
  onOpenChange,
  channelUuid,
  viewerId,
  list,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelUuid: string;
  viewerId: number | null;
  /** Presence switches to edit mode (title + description only). */
  list?: TaskList;
  /** Called with the new list's uuid after a successful create. Passing it also
   *  takes over the close — see the create branch of `handleSubmit`. */
  onCreated?: (listUuid: string) => void;
}) {
  const isEdit = !!list;
  const createList = useCreateList(channelUuid, viewerId);
  const updateList = useUpdateList(channelUuid, list?.uuid ?? '');

  const [title, setTitle] = useState(list?.title ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submitting = createList.isPending || updateList.isPending;
  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    const onError = (mutationError: Error) =>
      setError(extractApiError(mutationError).message);

    if (isEdit && list) {
      updateList.mutate(
        {
          title: trimmedTitle,
          description: description.trim() || undefined,
        },
        { onSuccess: () => onOpenChange(false), onError },
      );
      return;
    }

    const cleanedItems: CreateListItemInput[] = items
      .map((item) => item.content.trim())
      .filter((content) => content.length > 0)
      .map((content) => ({ content }));

    createList.mutate(
      {
        title: trimmedTitle,
        description: description.trim() || undefined,
        items: cleanedItems.length > 0 ? cleanedItems : undefined,
      },
      {
        onSuccess: (response) => {
          // ON CREATE THE CALLER OWNS THE CLOSE, because it also owns where the
          // reader lands. Closing here is a history move (`useUrlOverlay`): it
          // pops the entry this dialog was opened on, and the `?list=` write
          // that follows would land on that doomed entry and be undone. The
          // caller closes IN PLACE and selects in one handler instead.
          if (onCreated) {
            onCreated(response.data.uuid);
            return;
          }
          onOpenChange(false);
        },
        onError,
      },
    );
  };

  const handleItemKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    isLast: boolean,
  ) => {
    // IME composition's Enter confirms the composition, never a new row (M5).
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (isLast && items.length < LIST_MAX_ITEMS) {
        setItems((prev) => [...prev, newItemDraft()]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit list' : 'New list'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this list’s title and description.'
              : 'Create a shared task list for everyone in this channel.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="list-title">Title</Label>
            <Input
              id="list-title"
              maxLength={LIST_TITLE_MAX}
              placeholder="e.g. Filing checklist"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="list-description">Description</Label>
            <Textarea
              id="list-description"
              maxLength={LIST_DESCRIPTION_MAX}
              rows={2}
              placeholder="Optional — what is this list for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {items.length}/{LIST_MAX_ITEMS}
                </span>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <Input
                        maxLength={LIST_ITEM_MAX}
                        placeholder={`Item ${index + 1}`}
                        value={item.content}
                        onChange={(event) =>
                          setItems((prev) =>
                            prev.map((draft) =>
                              draft.key === item.key
                                ? { ...draft, content: event.target.value }
                                : draft,
                            ),
                          )
                        }
                        onKeyDown={(event) =>
                          handleItemKeyDown(event, index === items.length - 1)
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground"
                        onClick={() =>
                          setItems((prev) =>
                            prev.filter((draft) => draft.key !== item.key),
                          )
                        }
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <X aria-hidden className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setItems((prev) => [...prev, newItemDraft()])}
                disabled={items.length >= LIST_MAX_ITEMS}
              >
                <Plus aria-hidden className="size-4" />
                Add item
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create list'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
