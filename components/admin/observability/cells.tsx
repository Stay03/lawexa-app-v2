'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { JobUserRef } from '@/lib/utils/observability';

/** Relative timestamp with an absolute value in the tooltip. */
export function TimeAgoCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-sm text-muted-foreground">—</span>;
  const date = new Date(value);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help text-sm text-muted-foreground">
          {formatDistanceToNow(date, { addSuffix: true })}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{format(date, 'PPpp')}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Truncated error text (destructive) with the full message in the tooltip. */
export function ErrorCell({
  error,
  className,
  wrap = false,
}: {
  error: string | null;
  className?: string;
  /**
   * Show the whole message instead of one clipped line.
   *
   * The default keeps a long stack-ish error from wrecking a dense table, and
   * the tooltip carries the rest. But where the message IS the row's content —
   * the reason we refused to overwrite a case, which somebody is being asked to
   * rule on — clipping it hides the part that decides the answer. Measured on
   * screen: "The fetched document does not agree with the case it woul…", cut
   * exactly at the meaning. A tooltip only helps a reader who guesses it exists.
   */
  wrap?: boolean;
}) {
  if (!error) return <span className="text-sm text-muted-foreground">—</span>;
  if (wrap) {
    return (
      <span className={cn('block text-sm text-destructive', className)}>{error}</span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block truncate text-sm text-destructive cursor-help', className)}>
          {error}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[420px]">
        <p className="whitespace-pre-wrap text-xs">{error}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Name over muted email for a job's owner/uploader. */
export function UserCell({ user }: { user: JobUserRef | null }) {
  if (!user) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{user.name}</p>
      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
    </div>
  );
}
