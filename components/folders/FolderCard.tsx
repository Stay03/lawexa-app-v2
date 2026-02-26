'use client';

import Link from 'next/link';
import { ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { getFolderIcon } from './FolderIconPicker';
import type { FolderSummary } from '@/types/folder';

/******************************************************************************
                               Types
******************************************************************************/

interface FolderCardProps {
  folder: FolderSummary;
  className?: string;
  style?: React.CSSProperties;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Compact folder list item for grouped display.
 */
function FolderCard({ folder, className, style }: FolderCardProps) {
  const {
    uuid,
    name,
    icon,
    color,
    is_private,
    user,
    children_count,
    items_count,
    is_bookmarked,
    created_at,
  } = folder;
  // Resolve icon component
  const Icon = getFolderIcon(icon);
  // Format date
  const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link
      href={`/folders/${uuid}`}
      className={cn(
        'group flex items-center gap-3',
        'px-5 py-4',
        'transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
      style={style}
    >
      {/* Folder icon */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: color ? `${color}18` : undefined,
          color: color || undefined,
        }}
      >
        <Icon className={cn('h-4 w-4', !color && 'text-muted-foreground')} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h3 className="min-w-0 flex-1 text-[20px] font-medium text-foreground group-hover:text-primary sm:truncate">
            {name}
          </h3>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[16px] text-muted-foreground sm:flex-nowrap sm:gap-2.5">
            {/* Counts */}
            {items_count > 0 && (
              <span>{items_count} {items_count === 1 ? 'item' : 'items'}</span>
            )}
            {children_count > 0 && (
              <span>{children_count} {children_count === 1 ? 'subfolder' : 'subfolders'}</span>
            )}

            {/* Privacy indicator */}
            {is_private && (
              <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}

            {/* Date */}
            <span className="tabular-nums">{formattedDate}</span>

            <BookmarkButton
              type="folder"
              id={folder.id}
              isBookmarked={is_bookmarked}
              variant="icon"
              className="h-7 w-7"
            />
            <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </div>

        {/* Author */}
        {user && (
          <div className="mt-1 flex items-center gap-1.5 text-[16px] text-muted-foreground">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span>{user.name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FolderCard };
