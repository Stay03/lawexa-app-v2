'use client';

import { Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToggleBookmark } from '@/lib/hooks/useBookmarks';
import { extractApiError } from '@/lib/utils/api-error';
import type { BookmarkType } from '@/types/bookmark';

interface BookmarkButtonProps {
  type: BookmarkType;
  id: number;
  isBookmarked: boolean;
  bookmarksCount?: number;
  /** 'icon' = icon-only (for cards), 'full' = icon + label (for detail pages) */
  variant?: 'icon' | 'full';
  className?: string;
}

/**
 * Reusable bookmark toggle button for cases and notes.
 * Uses optimistic updates via useToggleBookmark hook.
 */
function BookmarkButton({
  type,
  id,
  isBookmarked,
  bookmarksCount,
  variant = 'icon',
  className,
}: BookmarkButtonProps) {
  const toggleBookmark = useToggleBookmark();

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await toggleBookmark.mutateAsync({ type, id });
      if (result.data.bookmarked) {
        toast.success('Bookmark added', {
          description: `This ${type} has been saved to your bookmarks.`,
        });
      } else {
        toast.success('Bookmark removed', {
          description: `This ${type} has been removed from your bookmarks.`,
        });
      }
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to update bookmark', {
        description: apiError.message,
      });
    }
  };

  const label = isBookmarked ? 'Remove bookmark' : 'Bookmark';

  if (variant === 'full') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={toggleBookmark.isPending}
        className={cn('gap-1.5', className)}
      >
        <Bookmark className={cn('h-4 w-4', isBookmarked && 'fill-current')} />
        {isBookmarked ? 'Bookmarked' : 'Bookmark'}
        {bookmarksCount !== undefined && bookmarksCount > 0 && (
          <span className="text-muted-foreground">({bookmarksCount})</span>
        )}
      </Button>
    );
  }

  // Icon-only variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            disabled={toggleBookmark.isPending}
            className={cn('h-8 w-8', className)}
          >
            <Bookmark className={cn('h-4 w-4', isBookmarked && 'fill-current')} />
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { BookmarkButton };
