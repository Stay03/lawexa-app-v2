'use client';

import Link from 'next/link';
import {
  Scale,
  FileText,
  MessageSquare,
  Folder,
  BookOpen,
  Trash2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getFileIcon } from '@/lib/utils/file-display';
import { Button } from '@/components/ui/button';
import { useRemoveFolderItem } from '@/lib/hooks/useFolders';
import { useDownloadFile } from '@/lib/hooks/useFiles';
import { extractApiError } from '@/lib/utils/api-error';
import type { FolderItem, FolderItemType } from '@/types/folder';

/******************************************************************************
                               Constants
******************************************************************************/

type NonFileType = Exclude<FolderItemType, 'file'>;

const NON_FILE_TYPE_ICONS: Record<NonFileType, typeof Scale> = {
  case: Scale,
  note: FileText,
  conversation: MessageSquare,
  folder: Folder,
  statute: BookOpen,
};

const TYPE_LABELS: Record<FolderItemType, string> = {
  case: 'Case',
  note: 'Note',
  conversation: 'Conversation',
  folder: 'Folder',
  statute: 'Statute',
  file: 'File',
};

/******************************************************************************
                               Types
******************************************************************************/

interface FolderItemCardProps {
  item: FolderItem;
  folderUuid: string;
  isOwner: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Polymorphic folder item card.
 */
function FolderItemCard({
  item,
  folderUuid,
  isOwner,
  className,
  style,
}: FolderItemCardProps) {
  const removeItem = useRemoveFolderItem();
  // File items open via a fresh signed URL fetched on click (the cached
  // presigned URL on `content.url` can outlive its 1-hour TTL).
  const downloadFile = useDownloadFile();

  const Icon =
    item.type === 'file'
      ? getFileIcon(item.content.mime_type)
      : NON_FILE_TYPE_ICONS[item.type];
  const typeLabel = TYPE_LABELS[item.type];
  const title = _getItemTitle(item);
  const href = item.type === 'file' ? null : _getNonFileHref(item);
  const addedDateObj = new Date(item.added_at);
  const addedDate = addedDateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(addedDateObj.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
  });

  const handleOpenFile = () => {
    if (item.type !== 'file') return;
    downloadFile.mutate(item.content.id);
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const contentId = Number(_getContentId(item));
      await removeItem.mutateAsync({
        uuid: folderUuid,
        data: { type: item.type, id: contentId },
      });
      toast.success('Item removed', {
        description: `${typeLabel} removed from folder.`,
      });
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to remove item', {
        description: apiError.message,
      });
    }
  };

  const rowClassName = cn(
    'group flex w-full items-center gap-3 text-left',
    'px-3 py-3 sm:px-5 sm:py-4',
    'transition-colors hover:bg-muted/40',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
    className
  );

  const inner = (
    <>
      {/* Type icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-base font-medium text-foreground group-hover:text-primary">
            {title}
          </h3>

          <div className="hidden shrink-0 items-center gap-2.5 text-sm text-muted-foreground sm:flex">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {typeLabel}
            </span>
            <span className="tabular-nums">{addedDate}</span>
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={handleRemove}
                disabled={removeItem.isPending}
                aria-label="Remove from folder"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Remove from folder</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Trailing affordance */}
      {item.type === 'file' ? (
        <ExternalLink className="h-4 w-4 shrink-0 opacity-50 transition-all group-hover:opacity-100" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      )}
    </>
  );

  if (item.type === 'file') {
    return (
      <button
        type="button"
        onClick={handleOpenFile}
        disabled={downloadFile.isPending}
        className={cn(rowClassName, 'disabled:opacity-60')}
        style={style}
        aria-label={`Open ${title}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link href={href ?? '#'} className={rowClassName} style={style}>
      {inner}
    </Link>
  );
}

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Extract display title from polymorphic folder item content.
 */
function _getItemTitle(item: FolderItem): string {
  if (item.type === 'file') return item.content.original_name;
  const content = item.content;
  if (typeof content.title === 'string' && content.title) return content.title;
  if (typeof content.name === 'string' && content.name) return content.name;
  return `Untitled ${item.type}`;
}

/**
 * Build navigation href for non-file folder items.
 */
function _getNonFileHref(item: Extract<FolderItem, { type: NonFileType }>): string {
  const content = item.content;
  const slug = typeof content.slug === 'string' ? content.slug : undefined;
  const uuid = typeof content.uuid === 'string' ? content.uuid : undefined;
  const id = content.id;
  switch (item.type) {
    case 'case':
      return `/cases/${slug ?? id}`;
    case 'note':
      return `/notes/${slug ?? id}`;
    case 'conversation':
      return `/c/${id}`;
    case 'folder':
      return `/folders/${uuid ?? id}`;
    case 'statute':
      return `/statutes/${slug ?? id}`;
    default:
      return '#';
  }
}

/**
 * Read the underlying content id (file id, case id, …) from a folder item.
 */
function _getContentId(item: FolderItem): number | string {
  if (item.type === 'file') return item.content.id;
  const raw = item.content.id;
  return typeof raw === 'number' || typeof raw === 'string' ? raw : 0;
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FolderItemCard };
