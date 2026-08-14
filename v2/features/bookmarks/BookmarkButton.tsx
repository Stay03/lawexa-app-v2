'use client';

import { Bookmark } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useToggleCaseBookmark } from './mutations';

/**
 * BookmarkButton — save / unsave a case.
 *
 * TWO VARIANTS, one behaviour: `icon` for a list row (a bare star), `full` for
 * the case page's action bar (star + label + count). Both write through the same
 * optimistic mutation, so the row a reader saved from the list is already saved
 * when they open it.
 *
 * NO LOCAL STATE. The flag comes from the cache entry the row was rendered from
 * and the mutation writes back into that same cache, so there is nothing to keep
 * in sync — which is what makes the same case show the same state in the browse
 * list, the trending list and the case page at once. v1's button held its own
 * `useState` seeded from a prop, and that is exactly why those surfaces
 * disagreed.
 *
 * The press animates on the ICON only (`scale`), never on the hit area: the
 * target must not move under a thumb mid-press. Guarded by `motion-safe`.
 */
export function BookmarkButton({
  caseId,
  isBookmarked,
  count,
  variant = 'icon',
  className,
}: {
  caseId: number;
  isBookmarked: boolean;
  /** Shown by the `full` variant when the API supplied one. */
  count?: number;
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const toggle = useToggleCaseBookmark(caseId);

  const press = (event: React.MouseEvent) => {
    // A row is a link; the star inside it must not navigate.
    event.preventDefault();
    event.stopPropagation();
    toggle.mutate({ next: !isBookmarked });
  };

  const label = isBookmarked ? 'Remove bookmark' : 'Save case';

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
            'size-4',
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
          'size-4',
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
