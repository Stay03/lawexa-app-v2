import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Lawyer verification silhouette: the heading from `md:` up, the status
 * panel, then one headed block and the upload zone under it. It is the shape
 * of the screen before anything is sent, which is the state most people open
 * it in; a profile under review or verified draws the same panel and a shorter
 * list, so the hand-off only ever removes height below the panel.
 *
 * Drawn by the route's `loading.tsx` and by the screen while the profile
 * loads, so both waits look the same.
 */
export function VerificationFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your verification
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-56 rounded-lg md:block" />
        <div className="flex gap-3.5 rounded-2xl bg-secondary p-4">
          <Skeleton className="size-10 shrink-0 rounded-xl bg-background/70" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-5 w-20 rounded-full bg-background/70" />
            <Skeleton className="h-5 w-56 rounded bg-background/70" />
            <Skeleton className="h-3.5 w-full rounded bg-background/70" />
            <Skeleton className="h-3.5 w-4/5 rounded bg-background/70" />
          </div>
        </div>
        <div className="mt-5">
          <Skeleton className="mb-2 h-4 w-28 rounded" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
        <Skeleton className="mt-5 h-28 w-full rounded-2xl" />
      </div>
    </>
  );
}
