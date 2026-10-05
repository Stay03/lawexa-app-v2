'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { SegmentFallback } from '@/v2/shell/segment-fallback';
import { useActivateNotification } from './mutations';
import { presentNotification } from './presentation';
import { notificationsQueries } from './queries';
import {
  NotificationExternalState,
  NotificationGoneState,
  NotificationResolveErrorState,
  NotificationsSignedOutState,
} from './states';

/**
 * NotificationResolver — `/notifications/{id}`, which is not a page.
 *
 * ── WHY THERE IS NO DETAIL PAGE ────────────────────────────────────────────
 * The API stores a 140-character preview when a notification is created, and
 * `GET /notifications/{id}` returns that same text (measured byte-identical to
 * the list row, 2026-10-05). A detail page would show the row's two lines in a
 * bigger box. The full text lives at the row's DESTINATION, so that is where
 * this address sends the reader.
 *
 * ── WHY THE ADDRESS EXISTS AT ALL ──────────────────────────────────────────
 * v1 sent a destination-less row to `/notifications/{id}`, and that address is
 * in people's history and in v1's dropdown. Claimed by v2, it lands inside the
 * shell instead of ejecting to v1, and does the one thing v1's detail page did
 * that mattered: it marks the row read on arrival.
 *
 * WHAT IT DOES, per destination:
 *  - internal → mark read, warm the channel if it points into one, and
 *    `router.replace` there, so Back skips this hop.
 *  - none     → mark read and replace to the inbox, where the row is.
 *  - external → mark read and SHOW the link: a new tab needs the reader's own
 *    gesture, and a link into the app must not replace it with someone else's.
 *  - 404      → "This notification is gone" (deleted, or another account's).
 *
 * The redirect rides an effect guarded by a ref, so it runs once per row,
 * including under Strict Mode's double effects. No state is set in it.
 */
export function NotificationResolver({ id }: { id: string }) {
  const { signedIn } = useV2Session();
  const router = useRouter();
  const activate = useActivateNotification();

  const query = useQuery({
    ...notificationsQueries.detail(id),
    enabled: signedIn,
  });
  const notification = query.data?.data ?? null;
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!notification || handled.current === notification.id) return;
    handled.current = notification.id;
    activate(notification);
    const { destination } = presentNotification(notification);
    if (destination.kind === 'internal') router.replace(destination.href);
    else if (destination.kind === 'none') router.replace('/notifications');
  }, [notification, activate, router]);

  if (!signedIn) {
    return (
      <Column>
        <NotificationsSignedOutState />
      </Column>
    );
  }

  if (query.isError) {
    return (
      <Column>
        {extractApiError(query.error).status === 404 ? (
          <NotificationGoneState />
        ) : (
          <NotificationResolveErrorState onRetry={() => void query.refetch()} />
        )}
      </Column>
    );
  }

  const presentation = notification ? presentNotification(notification) : null;
  const destination = presentation?.destination;
  if (presentation && destination?.kind === 'external') {
    return (
      <Column>
        <NotificationExternalState title={presentation.title} href={destination.href} />
      </Column>
    );
  }

  // Loading, or on the way out: nothing to silhouette, because the next screen
  // is not this one. The status line is what a screen reader gets instead.
  return <SegmentFallback label="Opening notification" />;
}

/** The reading column, with the screen's heading said for the ear only: the
 *  bar carries no title here and the state's own sentence is the visible one. */
function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className={LIST_COLUMN}>
      <h1 className="sr-only">Notification</h1>
      {children}
    </div>
  );
}
