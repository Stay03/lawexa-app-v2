'use client';

import { formatFullTimestamp, formatRelativeTime } from '@/lib/utils/collab';
import type { TaskListSummary } from '@/types/collab';

import { ListCreatorLabel } from './ListCreatorLabel';
import { ListProgress } from './ListProgress';

interface ListCardProps {
  list: TaskListSummary;
  onSelect: (listUuid: string) => void;
}

/**
 * A selectable list tile for the index grid: title, a line-clamped description,
 * a completion bar, and a footer with the creator identity + when it was last
 * touched. Rendered as a `<button>` so it's keyboard-activatable and focusable.
 */
export function ListCard({ list, onSelect }: ListCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(list.uuid)}
      className="group flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-foreground">
          {list.title}
        </h3>
        {list.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {list.description}
          </p>
        )}
      </div>

      {list.items_count > 0 ? (
        <ListProgress checked={list.checked_count} total={list.items_count} />
      ) : (
        <p className="text-xs text-muted-foreground">No items yet</p>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <ListCreatorLabel isAi={list.is_ai} creator={list.creator} />
        <time
          dateTime={list.updated_at}
          title={formatFullTimestamp(list.updated_at)}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {formatRelativeTime(list.updated_at)}
        </time>
      </div>
    </button>
  );
}
