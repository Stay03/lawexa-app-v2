'use client';

import { Bookmark } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useToggleStatuteBookmark } from './mutations';

/**
 * StatuteBookmarkButton — save / unsave a statute. The case
 * `BookmarkButton`'s two variants and behaviour exactly (that component is
 * wired to the case-scoped mutation, so the statute library carries its own):
 * `icon` for a list row, `full` for the reader's action bar; no local state —
 * the flag comes from the cache entry the surface rendered from, and the
 * optimistic mutation writes back into that same cache.
 */
export function StatuteBookmarkButton({
  statuteId,
  isBookmarked,
  count,
  variant = 'icon',
  className,
}: {
  statuteId: number;
  isBookmarked: boolean;
  /** Shown by the `full` variant when the API supplied one. */
  count?: number;
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const toggle = useToggleStatuteBookmark(statuteId);

  const press = (event: React.MouseEvent) => {
    // A row is a link; the star inside it must not navigate.
    event.preventDefault();
    event.stopPropagation();
    toggle.mutate({ next: !isBookmarked });
  };

  const label = isBookmarked ? 'Remove bookmark' : 'Save statute';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={press}
        aria-label={label}
        aria-pressed={isBookmarked}
        className={cn(
          'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          isBookmarked && 'text-primary hover:text-primary',
          FOCUS_RING,
          className,
        )}
      >
        <Bookmark
          aria-hidden
          className={cn(
            'size-4 transition-transform motion-safe:duration-150 active:scale-90',
            isBookmarked && 'fill-current',
          )}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={press}
      aria-pressed={isBookmarked}
      className={cn(
        'v2-interactive inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        isBookmarked && 'border-primary/40 bg-primary/5 text-primary hover:text-primary',
        FOCUS_RING,
        className,
      )}
    >
      <Bookmark
        aria-hidden
        className={cn(
          'size-4 transition-transform motion-safe:duration-150 active:scale-90',
          isBookmarked && 'fill-current',
        )}
      />
      <span>{isBookmarked ? 'Saved' : 'Save'}</span>
      {typeof count === 'number' && count > 0 ? (
        <span className="tabular-nums text-xs text-muted-foreground/70">{count}</span>
      ) : null}
    </button>
  );
}
