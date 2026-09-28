import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Signed-in devices silhouette: the heading from `md:` up, "This device"
 * over one 56px row, and "Other devices" with its sentence over two rows.
 * Drawn by the route's `loading.tsx` and by the screen while the list loads,
 * so both waits look the same.
 */
export function DevicesFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your devices
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-52 rounded-lg md:block" />
        <div className="flex flex-col gap-5">
          <div>
            <Skeleton className="mb-2 h-4 w-24 rounded" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-28 rounded" />
            <Skeleton className="mb-2 h-4 w-72 rounded" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </>
  );
}
