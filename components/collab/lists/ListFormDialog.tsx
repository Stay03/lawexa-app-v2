'use client';

import { type KeyboardEvent, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

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
import { useCreateList, useUpdateList } from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { CreateListItemInput, TaskList } from '@/types/collab';

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 5000;
const ITEM_MAX = 1000;
const MAX_ITEMS = 100;

interface ItemDraft {
  /** Stable key so rows never re-key by array index. */
  key: string;
  content: string;
}

let itemDraftCounter = 0;
function newItemDraft(content = ''): ItemDraft {
  itemDraftCounter += 1;
  return { key: `draft-${itemDraftCounter}`, content };
}

interface ListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelUuid: string;
  /** Presence switches the dialog into edit mode (title + description only). */
  list?: TaskList;
  /** Called with the new list's uuid after a successful create. */
  onCreated?: (listUuid: string) => void;
}

/**
 * Create or edit a task list. Create mode adds an optional initial-items
 * repeater (the create endpoint accepts `items[]`); edit mode only touches the
 * title + description. On create we bubble the new list's uuid up so the panel
 * can open it straight away.
 */
export function ListFormDialog({
  open,
  onOpenChange,
  channelUuid,
  list,
  onCreated,
}: ListFormDialogProps) {
  const isEdit = !!list;
  const createList = useCreateList(channelUuid);
  const updateList = useUpdateList(channelUuid, list?.uuid ?? '');

  const [title, setTitle] = useState(list?.title ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submitting = createList.isPending || updateList.isPending;
  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !submitting;

  const addItemRow = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, newItemDraft()]);
  };

  const updateItemRow = (key: string, content: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, content } : item))
    );
  };

  const removeItemRow = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);

    try {
      if (isEdit && list) {
        await updateList.mutateAsync({
          title: trimmedTitle,
          description: description.trim() || undefined,
        });
        toast.success('List updated');
        onOpenChange(false);
      } else {
        const cleanedItems: CreateListItemInput[] = items
          .map((item) => item.content.trim())
          .filter((content) => content.length > 0)
          .map((content) => ({ content }));

        const response = await createList.mutateAsync({
          title: trimmedTitle,
          description: description.trim() || undefined,
          items: cleanedItems.length > 0 ? cleanedItems : undefined,
        });
        toast.success('List created');
        onOpenChange(false);
        onCreated?.(response.data.uuid);
      }
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  const handleItemKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    isLast: boolean
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isLast) addItemRow();
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
              autoFocus
              maxLength={TITLE_MAX}
              placeholder="e.g. Sprint plan"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="list-description">Description</Label>
            <Textarea
              id="list-description"
              maxLength={DESCRIPTION_MAX}
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
                  {items.length}/{MAX_ITEMS}
                </span>
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <Input
                        maxLength={ITEM_MAX}
                        placeholder={`Item ${index + 1}`}
                        value={item.content}
                        onChange={(event) =>
                          updateItemRow(item.key, event.target.value)
                        }
                        onKeyDown={(event) =>
                          handleItemKeyDown(event, index === items.length - 1)
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground"
                        onClick={() => removeItemRow(item.key)}
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <X className="h-4 w-4" />
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
                onClick={addItemRow}
                disabled={items.length >= MAX_ITEMS}
              >
                <Plus className="h-4 w-4" />
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
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create list'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
