'use client';

import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Settings2 } from 'lucide-react';

import { LIST_COLUMN } from '@/v2/shell/page-columns';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenAction,
} from '@/v2/shell/screen-context';
import { INBOX_HEADING, NotificationsInbox } from './NotificationsInbox';
import { NotificationsListSkeleton } from './states';

/**
 * NotificationsScreen — the `/notifications` client root. Two jobs, both ABOVE
 * the `useSearchParams` boundary so neither waits on the URL:
 *
 *  1. The Suspense boundary Next requires around the `useSearchParams`
 *     consumer (`NotificationsInbox` reads the tab), with a fallback that is
 *     `(inbox)/loading.tsx` exactly, so route boundary → this fallback → live
 *     list is one continuous shape (the `BookmarksScreen` shape).
 *  2. The screen's one action in the bar's overflow menu, "Notification
 *     settings". Published here rather than drawn as a gear in the body: the
 *     bar already has one menu, and the owner's rule is one place to look
 *     (`screen-context.ts`). The delivery switches themselves live on
 *     `/settings/notifications` and in the bell's gear; this screen adds none.
 *
 * `/notifications` is a PUSHED screen (`pushed-route.ts`): it is opened from
 * the bell, a control on every screen, so the bar carries a back chevron and,
 * below `md:`, the title.
 */
export function NotificationsScreen() {
  const router = useRouter();
  const pathname = usePathname() ?? '/notifications';

  const openSettings = useCallback(() => {
    router.push('/settings/notifications');
  }, [router]);
  const actions = useMemo<readonly ScreenAction[]>(
    () => [
      {
        id: 'settings',
        label: 'Notification settings',
        icon: Settings2,
        onSelect: openSettings,
      },
    ],
    [openSettings],
  );

  useEffect(() => {
    setScreenContext({ pathname, back: null, actions });
  }, [pathname, actions]);
  useEffect(() => () => clearScreenContext(), []);

  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationsInbox />
    </Suspense>
  );
}

/**
 * Suspense fallback and route fallback, one component: the heading and the tab
 * strip as reserved chrome (furniture, not content placeholders) over the real
 * list skeleton. `app/v2/notifications/(inbox)/loading.tsx` imports this so the
 * two can never drift.
 *
 * `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is DELETED, not
 * reconciled, when content arrives, so anything focusable in here would lose
 * focus mid-interaction. The heading is a `div` here for the same reason the
 * live screen's is an `h1`: the document has exactly one.
 */
export function NotificationsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading notifications
      </span>
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className={INBOX_HEADING}>Notifications</div>
        <div className="mb-3 flex items-center">
          <div className="h-9 w-40 max-w-full rounded-full bg-secondary/60" />
        </div>
        <NotificationsListSkeleton />
      </div>
    </>
  );
}
