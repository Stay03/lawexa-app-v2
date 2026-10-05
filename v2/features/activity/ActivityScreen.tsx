'use client';

import { Suspense } from 'react';

import { useV2Session } from '@/v2/runtime/session-context';
import { ActivityList } from './ActivityList';
import { ActivityFallback } from './states';

/**
 * ActivityScreen — the `/activity` client root (the `ConversationsScreen`
 * shape). One job, above the `useSearchParams` boundary: wrap the list, which
 * reads `?page=`, in the Suspense boundary Next requires, with the same
 * fallback `loading.tsx` draws, so route boundary → fallback → list is one
 * shape.
 *
 * `/activity` is a PUSHED screen, opened from Settings (`pushed-route.ts`):
 * the back arrow and the title ride the bar below `md:`, and the page's own
 * heading takes over from `md:` (`ActivityHeading`). `signedIn` is the
 * layout's server-verified flag, read from context so this segment awaits
 * nothing.
 */
export function ActivityScreen() {
  const { signedIn } = useV2Session();

  return (
    <Suspense fallback={<ActivityFallback />}>
      <ActivityList signedIn={signedIn} />
    </Suspense>
  );
}
