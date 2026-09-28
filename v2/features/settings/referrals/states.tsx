import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Referrals silhouette. Most people who open it are not ambassadors, so it
 * is the centred message's shape (an icon, two lines, a button), which is what
 * they then see; an ambassador's screen settles downward from it.
 */
export function ReferralsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your referrals
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-32 rounded-lg md:block" />
        <div className="flex flex-col items-center gap-3 px-6 py-16">
          <Skeleton className="size-12 rounded-2xl" />
          <Skeleton className="h-5 w-56 rounded" />
          <Skeleton className="h-4 w-72 rounded" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </>
  );
}
