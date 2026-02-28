'use client';

import { useState } from 'react';
import { FolderPlus, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getFolderIcon } from './FolderIconPicker';
import { useMyFolders, useAddFolderItem } from '@/lib/hooks/useFolders';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { extractApiError } from '@/lib/utils/api-error';
import type { FolderItemType } from '@/types/folder';

/******************************************************************************
                               Types
******************************************************************************/

interface AddToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: FolderItemType;
  itemId: number | string;
}

interface AddToFolderButtonProps {
  itemType: FolderItemType;
  itemId: number | string;
  variant?: 'icon' | 'full';
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Dialog for picking a folder to add an item to.
 * Used from detail pages (notes, cases, conversations).
 */
function AddToFolderDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
}: AddToFolderDialogProps) {
  const addItem = useAddFolderItem();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [addingUuid, setAddingUuid] = useState<string | null>(null);

  // Fetch user's folders
  const foldersQuery = useMyFolders({
    search: debouncedSearch || undefined,
    per_page: 15,
  });

  const folders = foldersQuery.data?.data || [];

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSearch('');
      setAddingUuid(null);
    }
    onOpenChange(isOpen);
  };

  // Handle selecting a folder
  const handleSelectFolder = async (folderUuid: string, folderName: string) => {
    setAddingUuid(folderUuid);
    try {
      const result = await addItem.mutateAsync({
        uuid: folderUuid,
        data: { type: itemType, id: itemId },
      });
      toast.success(result.message || `Added to "${folderName}".`);
      handleOpenChange(false);
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to add to folder', {
        description: apiError.message,
      });
    } finally {
      setAddingUuid(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add to Folder</DialogTitle>
          <DialogDescription>
            Choose a folder to add this {itemType} to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search your folders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Folders list */}
          <div className="max-h-[300px] overflow-y-auto rounded-lg border divide-y divide-border">
            {foldersQuery.isFetching ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : folders.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {debouncedSearch
                  ? `No folders found for "${debouncedSearch}".`
                  : 'You have no folders yet. Create one first.'}
              </div>
            ) : (
              folders.map((folder) => {
                const Icon = getFolderIcon(folder.icon);
                const isAdding = addingUuid === folder.uuid;
                return (
                  <button
                    key={folder.uuid}
                    type="button"
                    disabled={addingUuid !== null}
                    onClick={() => handleSelectFolder(folder.uuid, folder.name)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: folder.color ? `${folder.color}18` : undefined,
                        color: folder.color || undefined,
                      }}
                    >
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {folder.items_count} {folder.items_count === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Button that opens the AddToFolderDialog.
 * Place alongside BookmarkButton on detail pages.
 */
function AddToFolderButton({ itemType, itemId, variant = 'full' }: AddToFolderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'icon' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(true)}
              >
                <FolderPlus className="h-4 w-4" />
                <span className="sr-only">Add to folder</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add to folder</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
        >
          <FolderPlus className="mr-1 h-4 w-4" />
          Add to Folder
        </Button>
      )}
      <AddToFolderDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        itemType={itemType}
        itemId={itemId}
      />
    </>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { AddToFolderDialog, AddToFolderButton };
