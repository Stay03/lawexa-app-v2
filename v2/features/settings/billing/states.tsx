import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../SettingsList';

/**
 * The Billing silhouette: the heading from `md:` up, "Plan" over one 56px row
 * and "Invoices" over one row (the free-tier answer; more settles downward).
 */
export function BillingFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your billing
      </span>
      <div aria-hidden inert className={SETTINGS_COLUMN}>
        <Skeleton className="mb-5 hidden h-8 w-24 rounded-lg md:block" />
        <div className="flex flex-col gap-5">
          <div>
            <Skeleton className="mb-2 h-4 w-12 rounded" />
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
