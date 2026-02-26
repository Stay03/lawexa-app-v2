'use client';

import Link from 'next/link';
import {
  Scale,
  FileText,
  MessageSquare,
  Folder,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRemoveFolderItem } from '@/lib/hooks/useFolders';
import { extractApiError } from '@/lib/utils/api-error';
import type { FolderItem, FolderItemType } from '@/types/folder';

/******************************************************************************
                               Constants
******************************************************************************/

const TYPE_ICONS: Record<FolderItemType, typeof Scale> = {
  case: Scale,
  note: FileText,
  conversation: MessageSquare,
  folder: Folder,
};

const TYPE_LABELS: Record<FolderItemType, string> = {
  case: 'Case',
  note: 'Note',
  conversation: 'Conversation',
  folder: 'Folder',
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
  // Resolve display data from polymorphic content
  const Icon = TYPE_ICONS[item.type] || FileText;
  const typeLabel = TYPE_LABELS[item.type] || item.type;
  const title = _getItemTitle(item);
  const href = _getItemHref(item);
  const addedDate = new Date(item.added_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  // Handle remove
  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const contentId = Number(item.content.id);
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

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3',
        'px-5 py-4',
        'transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
      style={style}
    >
      {/* Type icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h3 className="min-w-0 flex-1 text-[20px] font-medium text-foreground group-hover:text-primary sm:truncate">
            {title}
          </h3>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[16px] text-muted-foreground sm:flex-nowrap sm:gap-2.5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[12px]">
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
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Remove from folder</span>
              </Button>
            )}
            <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </div>
      </div>
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
  const content = item.content;
  if (content.title && typeof content.title === 'string') return content.title;
  if (content.name && typeof content.name === 'string') return content.name;
  return `Untitled ${item.type}`;
}

/**
 * Build navigation href from polymorphic folder item.
 */
function _getItemHref(item: FolderItem): string {
  const content = item.content;
  switch (item.type) {
    case 'case':
      return `/cases/${content.slug || content.id}`;
    case 'note':
      return `/notes/${content.slug || content.id}`;
    case 'conversation':
      return `/c/${content.id}`;
    case 'folder':
      return `/folders/${content.uuid || content.id}`;
    default:
      return '#';
  }
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FolderItemCard };
