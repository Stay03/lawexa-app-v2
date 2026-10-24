import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { SETTINGS_BLOCK, SETTINGS_COLUMN } from '../SettingsList';

/** The fading row stack every v2 list skeleton uses, so a short list does not read as a wall. */
const ROW_OPACITY = ['opacity-100', 'opacity-80', 'opacity-60', 'opacity-40'] as const;

/** One list row's shape: the type tile, the title, and the status and date under it. */
function RowSkeleton({ className }: { className?: string }) {
  return (
    <li className={cn('flex min-h-[4.5rem] items-center gap-3.5 px-4 py-3', className)}>
      <Skeleton className="size-9 shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3.5 w-40 rounded" />
      </div>
    </li>
  );
}

/**
 * The My requests silhouette: the heading from `md:` up, the sentence and the
 * New request button, then four rows. Drawn by the route's `loading.tsx` and
 * by the screen while the first page loads, so both waits look the same.
 */
export function RequestsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your requests
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-40 rounded-lg md:block" />
        <div className="mb-5 flex items-center gap-3 px-1">
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-8 w-32 shrink-0 rounded-lg" />
        </div>
        <ul className={SETTINGS_BLOCK}>
          {ROW_OPACITY.map((opacity) => (
            <RowSkeleton key={opacity} className={opacity} />
          ))}
        </ul>
      </div>
    </>
  );
}

/** The next page arriving under the last row: two rows of the same shape. */
export function NextPageSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading more requests
      </span>
      <ul aria-hidden inert className={cn(SETTINGS_BLOCK, 'mt-3')}>
        <RowSkeleton />
        <RowSkeleton className="opacity-60" />
      </ul>
    </>
  );
}

/**
 * One request's silhouette: the status pill, the title in two lines, the
 * history block, and the notes block.
 */
export function RequestFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading the request
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="mt-3 h-7 w-4/5 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-32 rounded" />
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Skeleton className="mb-2 h-4 w-20 rounded" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-28 rounded" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </>
  );
}
