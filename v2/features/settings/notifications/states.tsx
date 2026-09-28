import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Notifications screen's silhouette, for its route `loading.tsx`: the
 * heading from `md:` up, then three groups (a heading line over a block of 2, 1
 * and 1 rows of 56px), the live screen's shape, so the hand-off moves nothing.
 */
export function NotificationsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Opening notification settings
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-44 rounded-lg md:block" />
        <div className="flex flex-col gap-5">
          <div>
            <Skeleton className="mb-2 h-4 w-40 rounded" />
            <Skeleton className="mb-2 h-4 w-56 rounded" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-40 rounded" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-16 rounded" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </>
  );
}
