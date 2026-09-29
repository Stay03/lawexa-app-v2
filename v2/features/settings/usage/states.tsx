import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Usage silhouette: the heading from `md:` up, then "Plan" over one row,
 * "AI messages" over two rows, and "Other limits" over two rows, at the live
 * row heights.
 */
export function UsageFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your usage
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-24 rounded-lg md:block" />
        <div className="flex flex-col gap-5">
          <div>
            <Skeleton className="mb-2 h-4 w-12 rounded" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-24 rounded" />
            <Skeleton className="h-[8.5rem] w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-24 rounded" />
            <Skeleton className="h-[9rem] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </>
  );
}
