import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Message packs silhouette: the heading from `md:` up, "Balance" over one
 * 56px row, "Purchase history" over one row (the empty answer; a longer
 * history settles downward), and the explanation's four lines.
 */
export function MessagePacksFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your message packs
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-44 rounded-lg md:block" />
        <div className="flex flex-col gap-5">
          <div>
            <Skeleton className="mb-2 h-4 w-16 rounded" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-32 rounded" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div className="space-y-2 px-1">
            <Skeleton className="h-4 w-44 rounded" />
            <Skeleton className="h-3.5 w-72 rounded" />
            <Skeleton className="h-3.5 w-64 rounded" />
            <Skeleton className="h-3.5 w-80 rounded" />
          </div>
        </div>
      </div>
    </>
  );
}
