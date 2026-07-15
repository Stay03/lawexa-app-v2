'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Scale, FileText, Files as FilesIcon, Search } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useAddFolderItem } from '@/lib/hooks/useFolders';
import { useNotes } from '@/lib/hooks/useNotes';
import { useCases } from '@/lib/hooks/useCases';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { filesApi } from '@/lib/api/files';
import { fileKeys } from '@/lib/hooks/useFiles';
import { formatFileSize, getFileExtension, getFileIcon } from '@/lib/utils/file-display';
import { extractApiError } from '@/lib/utils/api-error';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import type { UserFile } from '@/types/file';

/******************************************************************************
                               Constants
******************************************************************************/

type SearchType = 'case' | 'note' | 'file';

const SEARCH_TYPE_TABS = [
  { value: 'case', label: 'Cases', icon: <Scale className="h-4 w-4" /> },
  { value: 'note', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
  { value: 'file', label: 'Files', icon: <FilesIcon className="h-4 w-4" /> },
];

const FILE_PICKER_PAGE_SIZE = 20;

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
  const [searchType, setSearchType] = useState<SearchType>('case');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [addingId, setAddingId] = useState<number | null>(null);

  // Case/note queries — server-side search.
  const casesQuery = useCases({
    search: debouncedSearch || undefined,
    per_page: 10,
  });
  const notesQuery = useNotes({
    search: debouncedSearch || undefined,
    per_page: 10,
  });

  // Files query — the /files endpoint has no search param, so we fetch the
  // first page and filter by original_name client-side.
  const filesQuery = useQuery({
    queryKey: [...fileKeys.list({ per_page: FILE_PICKER_PAGE_SIZE }), 'picker'] as const,
    queryFn: () => filesApi.getList({ per_page: FILE_PICKER_PAGE_SIZE }),
    enabled: open && searchType === 'file',
    staleTime: 30 * 1000,
  });

  const filteredFiles: UserFile[] = (() => {
    const all = filesQuery.data?.data ?? [];
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((f) => f.original_name.toLowerCase().includes(needle));
  })();

  const isFetching =
    searchType === 'case'
      ? casesQuery.isFetching
      : searchType === 'note'
      ? notesQuery.isFetching
      : filesQuery.isFetching;

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
    setSearchType(value as SearchType);
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
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to add item', {
        description: apiError.message,
      });
    } finally {
      setAddingId(null);
    }
  };

  const searchPlaceholder =
    searchType === 'case'
      ? 'Search cases…'
      : searchType === 'note'
      ? 'Search notes…'
      : 'Filter your files by name…';

  const emptyCopy = (() => {
    if (debouncedSearch) {
      return `No ${_pluralLabel(searchType)} found for "${debouncedSearch}".`;
    }
    if (searchType === 'file') {
      return filesQuery.data && filesQuery.data.data.length === 0
        ? "You haven't uploaded any files yet."
        : 'Loading your files…';
    }
    return `Type to search for ${_pluralLabel(searchType)}.`;
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Item to Folder</DialogTitle>
          <DialogDescription>
            Search for a case, note, or file to add to this folder.
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
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Results list */}
          <div className="max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border divide-y divide-border">
            {isFetching ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : searchType === 'file' ? (
              filteredFiles.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {emptyCopy}
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const isAdding = addingId === file.id;
                  const FileIcon = getFileIcon(file.mime_type);
                  return (
                    <button
                      key={file.id}
                      type="button"
                      disabled={addingId !== null}
                      onClick={() => handleSelectItem(file.id, file.original_name)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {isAdding ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          title={file.original_name}
                        >
                          {file.original_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px] font-semibold"
                      >
                        {getFileExtension(file.mime_type)}
                      </Badge>
                    </button>
                  );
                })
              )
            ) : (
              (() => {
                const activeQuery = searchType === 'case' ? casesQuery : notesQuery;
                const results = activeQuery.data?.data || [];
                if (results.length === 0) {
                  return (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {emptyCopy}
                    </div>
                  );
                }
                return results.map((item) => {
                  const isAdding = addingId === item.id;
                  const title = searchType === 'case' ? getCaseDisplayTitle(item) : item.title;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={addingId !== null}
                      onClick={() => handleSelectItem(item.id, title)}
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
                        <p className="whitespace-nowrap text-sm font-medium">
                          {title}
                        </p>
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
                });
              })()
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/******************************************************************************
                               Functions
******************************************************************************/

function _pluralLabel(type: SearchType): string {
  return type === 'case' ? 'cases' : type === 'note' ? 'notes' : 'files';
}

/******************************************************************************
                               Export default
******************************************************************************/

export { AddItemToFolderDialog };
