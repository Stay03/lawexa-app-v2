import { Skeleton } from '@/components/ui/skeleton';

import { SETTINGS_COLUMN } from '../settings/SettingsList';

/** The rows' silhouette while a template or skill list loads: a heading line and three 64px rows. */
export function ItemsFallback({ label }: { label: string }) {
  return (
    <>
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden inert>
        <Skeleton className="mb-2 h-4 w-28 rounded" />
        <Skeleton className="mb-2 h-4 w-72 rounded" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </>
  );
}

/** The whole page's silhouette for a route's `loading.tsx`: the heading, then the rows. */
export function ItemsPageFallback({ label }: { label: string }) {
  return (
    <div className={SETTINGS_COLUMN}>
      <Skeleton aria-hidden className="mb-5 h-8 w-44 rounded-lg" />
      <ItemsFallback label={label} />
    </div>
  );
}
