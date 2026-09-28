import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Developer screen's silhouette, for `app/v2/settings/developer/loading.tsx`:
 * the heading from `md:` up and one block of two 56px rows (`h-28`), the live
 * screen's exact shape, so the hand-off moves nothing.
 */
export function DeveloperFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Opening developer settings
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-36 rounded-lg md:block" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </>
  );
}
