'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { CrestSkeleton } from '@/v2/features/collab/kit/Crest';

/**
 * rail-states — the space rail's reserved shapes.
 *
 * The rail is CHROME, not a page, so it has no route fallback and no `still`
 * variant: every shape here stands in for a request that is genuinely in
 * flight, which is precisely the case the house rule says must pulse. The
 * geometry mirrors the live rail row for row, so the hand-off is content
 * resolving rather than a layout swap — and because the rail lives in a layout
 * that never unmounts, these are drawn once per space and never again on a
 * channel switch.
 */

/** One rail row's silhouette — the 16px glyph and a name bar, at the live
 *  row's exact height so nothing settles when the names arrive. */
function RailRowSkeleton({ width }: { width: string }) {
  return (
    <div className="flex min-h-9 items-center gap-2 px-2 py-1.5">
      <Skeleton className="size-4 shrink-0 rounded" />
      <Skeleton className="h-3.5 rounded" style={{ width }} />
    </div>
  );
}

/** The channel list's pending shape — a realistic spread of name lengths with
 *  the house progressive-opacity fade. */
export function RailListSkeleton() {
  const widths = ['60%', '45%', '72%', '38%', '55%', '48%'];
  return (
    <div aria-hidden className="flex flex-col gap-0.5 px-1">
      {widths.map((width, index) => (
        <div key={width} style={{ opacity: Math.max(0.25, 1 - index * 0.15) }}>
          <RailRowSkeleton width={width} />
        </div>
      ))}
    </div>
  );
}

/** The rail's identity block while the space itself is resolving. Same box,
 *  same paddings, same two text lines as the live header. */
export function RailHeaderSkeleton() {
  return (
    <div aria-hidden className="px-2 pt-2">
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <CrestSkeleton size="md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-3/5 rounded" />
          <Skeleton className="h-2.5 w-2/5 rounded" />
        </div>
      </div>
      <div className="px-2 pb-2 pt-1.5">
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** The whole rail at rest — used while a channel's space is still unknown, so
 *  the rail occupies its width from the first frame and the pane beside it
 *  never shifts sideways when the space lands. */
export function RailFrameSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <RailHeaderSkeleton />
      <div className="mx-2 h-px shrink-0 bg-border/60" />
      <div className="min-h-0 flex-1 overflow-hidden pt-2">
        <RailListSkeleton />
      </div>
    </div>
  );
}
