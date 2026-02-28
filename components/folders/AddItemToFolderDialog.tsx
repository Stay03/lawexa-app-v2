'use client';

import { useState } from 'react';
import { Loader2, Scale, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddFolderItem } from '@/lib/hooks/useFolders';
import { useNotes } from '@/lib/hooks/useNotes';
import { useCases } from '@/lib/hooks/useCases';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { extractApiError } from '@/lib/utils/api-error';

/******************************************************************************
                               Constants
******************************************************************************/

const SEARCH_TYPE_TABS = [
  { value: 'case', label: 'Cases', icon: <Scale className="h-4 w-4" /> },
  { value: 'note', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
];

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
 * Default component. Dialog for adding an item to a folder with searchable picker.
 */
function AddItemToFolderDialog({
  open,
  onOpenChange,
  folderUuid,
}: AddItemToFolderDialogProps) {
  const addItem = useAddFolderItem();
  const [searchType, setSearchType] = useState<'case' | 'note'>('case');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [addingId, setAddingId] = useState<number | null>(null);

  // Search queries
  const casesQuery = useCases({
    search: debouncedSearch || undefined,
    per_page: 10,
  });
  const notesQuery = useNotes({
    search: debouncedSearch || undefined,
    per_page: 10,
  });

  const activeQuery = searchType === 'case' ? casesQuery : notesQuery;
  const results = activeQuery.data?.data || [];

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSearchType('case');
      setSearch('');
      setAddingId(null);
    }
    onOpenChange(isOpen);
  };

  // Handle type tab change
  const handleTypeChange = (value: string) => {
    setSearchType(value as 'case' | 'note');
    setSearch('');
  };

  // Handle selecting an item
  const handleSelectItem = async (id: number, title: string) => {
    setAddingId(id);
    try {
      const result = await addItem.mutateAsync({
        uuid: folderUuid,
        data: { type: searchType, id },
      });
      toast.success(result.message || `"${title}" added to folder.`);
      handleOpenChange(false);
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to add item', {
        description: apiError.message,
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Item to Folder</DialogTitle>
          <DialogDescription>
            Search for a case or note to add to this folder.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {/* Type selector */}
          <AnimatedTabs
            tabs={SEARCH_TYPE_TABS}
            value={searchType}
            onValueChange={handleTypeChange}
          />

          {/* Search input */}
          <div className="relative">
            <Input
              type="text"
              placeholder={`Search ${searchType === 'case' ? 'cases' : 'notes'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Results list */}
          <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border divide-y divide-border">
            {activeQuery.isFetching ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {debouncedSearch
                  ? `No ${searchType === 'case' ? 'cases' : 'notes'} found for "${debouncedSearch}".`
                  : `Type to search for ${searchType === 'case' ? 'cases' : 'notes'}.`}
              </div>
            ) : (
              results.map((item) => {
                const isAdding = addingId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={addingId !== null}
                    onClick={() => handleSelectItem(item.id, item.title)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : searchType === 'case' ? (
                        <Scale className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-nowrap text-sm font-medium">{item.title}</p>
                      {'content_preview' in item && (
                        <p className="whitespace-nowrap text-xs text-muted-foreground">
                          {(item as { content_preview: string }).content_preview}
                        </p>
                      )}
                      {'citation' in item && (item as { citation: string | null }).citation && (
                        <p className="whitespace-nowrap text-xs text-muted-foreground">
                          {(item as { citation: string | null }).citation}
                        </p>
                      )}
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

/******************************************************************************
                               Export default
******************************************************************************/

export { AddItemToFolderDialog };
