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
  statute: BookOpen,
};

const TYPE_LABELS: Record<FolderItemType, string> = {
  case: 'Case',
  note: 'Note',
  conversation: 'Conversation',
  folder: 'Folder',
  statute: 'Statute',
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
  const addedDateObj = new Date(item.added_at);
  const addedDate = addedDateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(addedDateObj.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
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
        'px-3 py-3 sm:px-5 sm:py-4',
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
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Remove from folder</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Chevron – always visible */}
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
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
    case 'statute':
      return `/statutes/${content.slug || content.id}`;
    default:
      return '#';
  }
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FolderItemCard };
