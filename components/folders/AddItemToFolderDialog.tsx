'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddFolderItem } from '@/lib/hooks/useFolders';
import { extractApiError } from '@/lib/utils/api-error';
import type { FolderItemType } from '@/types/folder';

/******************************************************************************
                               Types
******************************************************************************/

interface AddItemToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderUuid: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Dialog for adding an item to a folder.
 */
function AddItemToFolderDialog({
  open,
  onOpenChange,
  folderUuid,
}: AddItemToFolderDialogProps) {
  const addItem = useAddFolderItem();
  const [type, setType] = useState<FolderItemType>('note');
  const [itemId, setItemId] = useState('');

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setType('note');
      setItemId('');
    }
    onOpenChange(isOpen);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number(itemId);
    if (!id || isNaN(id)) {
      toast.error('Please enter a valid item ID.');
      return;
    }
    try {
      const result = await addItem.mutateAsync({
        uuid: folderUuid,
        data: { type, id },
      });
      toast.success(result.message || 'Item added to folder.');
      handleOpenChange(false);
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to add item', {
        description: apiError.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Item to Folder</DialogTitle>
          <DialogDescription>
            Select the content type and enter the item ID.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Content type */}
          <div className="space-y-2">
            <Label htmlFor="item-type">Type</Label>
            <Select value={type} onValueChange={v => setType(v as FolderItemType)}>
              <SelectTrigger id="item-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="case">Case</SelectItem>
                <SelectItem value="conversation">Conversation</SelectItem>
                <SelectItem value="folder">Folder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Item ID */}
          <div className="space-y-2">
            <Label htmlFor="item-id">Item ID</Label>
            <Input
              id="item-id"
              type="number"
              placeholder="Enter the item ID"
              value={itemId}
              onChange={v => setItemId(v.target.value)}
              min={1}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addItem.isPending || !itemId}>
              {addItem.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { AddItemToFolderDialog };
